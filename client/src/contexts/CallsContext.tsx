import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, type ApiIceServer } from "@/lib/api";
import { emitCallSignal, useRealtimeSubscription, type RealtimeEvent } from "@/lib/realtime";

export type CallMode = "audio" | "video";
type CallDirection = "incoming" | "outgoing";
type CallStatus = "incoming" | "ringing" | "connecting" | "connected";

export type CallSession = {
  callId: string;
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  mode: CallMode;
  direction: CallDirection;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit;
};

type CallsContextValue = {
  session: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  startCall: (input: { conversationId: string; peerId: string; peerName: string; peerAvatar?: string | null; mode: CallMode }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
};

const noOpAsync = async () => undefined;
const unavailableCalls: CallsContextValue = {
  session: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  startCall: noOpAsync,
  acceptCall: noOpAsync,
  declineCall: () => undefined,
  endCall: () => undefined,
  toggleMute: () => undefined,
  toggleCamera: () => undefined,
};

const CallsContext = createContext<CallsContextValue>(unavailableCalls);
const callEvents = ["call:invite", "call:answer", "call:candidate", "call:decline", "call:end", "call:busy"] as RealtimeEvent["name"][];

function readableMediaError(error: unknown, mode: CallMode) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return mode === "video" ? "يلزم السماح بالكاميرا والميكروفون لبدء اتصال الفيديو" : "يلزم السماح بالميكروفون لبدء المكالمة الصوتية";
  if (error instanceof DOMException && error.name === "NotFoundError") return mode === "video" ? "لم يتم العثور على كاميرا أو ميكروفون متاح" : "لم يتم العثور على ميكروفون متاح";
  return "تعذر بدء المكالمة حالياً. حاول مجدداً.";
}

function makeCallId() {
  return `call-${crypto.randomUUID()}`;
}

function callerPayload(value: unknown): { conversationId: string; callId: string; fromUserId: string; mode?: CallMode; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; caller?: { displayName?: string; avatarUrl?: string | null } } | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.conversationId !== "string" || typeof payload.callId !== "string" || typeof payload.fromUserId !== "string") return null;
  const mode = payload.mode === "audio" || payload.mode === "video" ? payload.mode : undefined;
  const description = payload.description && typeof payload.description === "object" ? payload.description as RTCSessionDescriptionInit : undefined;
  const candidate = payload.candidate && typeof payload.candidate === "object" ? payload.candidate as RTCIceCandidateInit : undefined;
  const caller = payload.caller && typeof payload.caller === "object" ? payload.caller as { displayName?: string; avatarUrl?: string | null } : undefined;
  return { conversationId: payload.conversationId, callId: payload.callId, fromUserId: payload.fromUserId, mode, description, candidate, caller };
}

export function CallsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const sessionRef = useRef<CallSession | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const setCurrentSession = useCallback((next: CallSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const updateSession = useCallback((change: Partial<CallSession>) => {
    const current = sessionRef.current;
    if (!current) return;
    setCurrentSession({ ...current, ...change });
  }, [setCurrentSession]);

  const stopMedia = useCallback(() => {
    peerRef.current?.getSenders().forEach(sender => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const finishCall = useCallback((notifyPeer: boolean, notice?: string) => {
    const current = sessionRef.current;
    if (notifyPeer && current) void emitCallSignal("call:end", { conversationId: current.conversationId, callId: current.callId });
    stopMedia();
    setCurrentSession(null);
    if (notice) toast.message(notice);
  }, [setCurrentSession, stopMedia]);

  const preparePeer = useCallback((iceServers: ApiIceServer[]) => {
    const peer = new RTCPeerConnection({ iceServers });
    peer.onicecandidate = event => {
      const current = sessionRef.current;
      if (event.candidate && current) void emitCallSignal("call:candidate", { conversationId: current.conversationId, callId: current.callId, candidate: event.candidate.toJSON() });
    };
    peer.ontrack = event => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStream(stream);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") updateSession({ status: "connected" });
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected" || peer.connectionState === "closed") finishCall(false, "انقطع اتصال المكالمة");
    };
    peerRef.current = peer;
    return peer;
  }, [finishCall, updateSession]);

  const captureMedia = useCallback(async (mode: CallMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const flushCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || !peer.remoteDescription) return;
    const queued = pendingCandidatesRef.current.splice(0);
    await Promise.all(queued.map(candidate => peer.addIceCandidate(candidate).catch(() => undefined)));
  }, []);

  const startCall = useCallback(async (input: { conversationId: string; peerId: string; peerName: string; peerAvatar?: string | null; mode: CallMode }) => {
    if (sessionRef.current) {
      toast.error("أنهِ المكالمة الحالية قبل بدء مكالمة جديدة");
      return;
    }
    try {
      const [iceConfig, stream] = await Promise.all([api.getCallIceConfig(), captureMedia(input.mode)]);
      const callId = makeCallId();
      const next: CallSession = { callId, conversationId: input.conversationId, peerId: input.peerId, peerName: input.peerName, peerAvatar: input.peerAvatar, mode: input.mode, direction: "outgoing", status: "ringing" };
      setCurrentSession(next);
      const peer = preparePeer(iceConfig.iceServers);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const delivery = await emitCallSignal("call:invite", { conversationId: input.conversationId, callId, mode: input.mode, description: offer });
      if (!delivery.success) {
        finishCall(false);
        toast.error("تعذر إرسال دعوة المكالمة. تحقق من اتصالك ثم حاول مجدداً.");
        return;
      }
      if (!iceConfig.turnConfigured) toast.message("سيُستخدم اتصال مباشر؛ قد تحتاج بعض الشبكات إلى خادم ترحيل لإتمام المكالمة");
    } catch (error) {
      finishCall(false);
      toast.error(readableMediaError(error, input.mode));
    }
  }, [captureMedia, finishCall, preparePeer, setCurrentSession]);

  const acceptCall = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.direction !== "incoming" || !current.offer) return;
    try {
      const [iceConfig, stream] = await Promise.all([api.getCallIceConfig(), captureMedia(current.mode)]);
      const peer = preparePeer(iceConfig.iceServers);
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      await peer.setRemoteDescription(current.offer);
      await flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      updateSession({ status: "connecting" });
      const delivery = await emitCallSignal("call:answer", { conversationId: current.conversationId, callId: current.callId, description: answer });
      if (!delivery.success) {
        finishCall(false, "تعذر تأكيد قبول المكالمة");
        return;
      }
      if (!iceConfig.turnConfigured) toast.message("قد تحتاج بعض الشبكات إلى خادم ترحيل لإتمام المكالمة");
    } catch (error) {
      finishCall(true);
      toast.error(readableMediaError(error, current.mode));
    }
  }, [captureMedia, finishCall, flushCandidates, preparePeer, updateSession]);

  const declineCall = useCallback(() => {
    const current = sessionRef.current;
    if (current) void emitCallSignal("call:decline", { conversationId: current.conversationId, callId: current.callId });
    finishCall(false);
  }, [finishCall]);

  const endCall = useCallback(() => finishCall(true), [finishCall]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const next = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; });
    setIsCameraOff(next);
  }, [isCameraOff]);

  const onCallEvent = useCallback((event: RealtimeEvent) => {
    const signal = callerPayload(event.payload);
    if (!signal) return;
    const current = sessionRef.current;
    if (event.name === "call:invite") {
      if (current) {
        void emitCallSignal("call:busy", { conversationId: signal.conversationId, callId: signal.callId });
        return;
      }
      if (!signal.mode || signal.description?.type !== "offer") return;
      setCurrentSession({ callId: signal.callId, conversationId: signal.conversationId, peerId: signal.fromUserId, peerName: signal.caller?.displayName || "مستخدم يمنا", peerAvatar: signal.caller?.avatarUrl, mode: signal.mode, direction: "incoming", status: "incoming", offer: signal.description });
      return;
    }
    if (!current || current.callId !== signal.callId || current.conversationId !== signal.conversationId) return;
    if (event.name === "call:answer" && current.direction === "outgoing" && signal.description?.type === "answer" && peerRef.current) {
      void peerRef.current.setRemoteDescription(signal.description).then(flushCandidates).then(() => updateSession({ status: "connecting" })).catch(() => finishCall(false, "تعذر إتمام اتصال المكالمة"));
      return;
    }
    if (event.name === "call:candidate" && signal.candidate) {
      const peer = peerRef.current;
      if (!peer || !peer.remoteDescription) pendingCandidatesRef.current.push(signal.candidate);
      else void peer.addIceCandidate(signal.candidate).catch(() => undefined);
      return;
    }
    if (event.name === "call:decline") finishCall(false, "تم رفض المكالمة");
    if (event.name === "call:busy") finishCall(false, "المستخدم في مكالمة أخرى");
    if (event.name === "call:end") finishCall(false, "أنهى الطرف الآخر المكالمة");
  }, [finishCall, flushCandidates, setCurrentSession, updateSession]);

  useRealtimeSubscription(callEvents, onCallEvent);
  useEffect(() => () => finishCall(true), [finishCall]);

  const value = useMemo<CallsContextValue>(() => ({ session, localStream, remoteStream, isMuted, isCameraOff, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera }), [session, localStream, remoteStream, isMuted, isCameraOff, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera]);
  return <CallsContext.Provider value={value}>{children}<CallOverlay /></CallsContext.Provider>;
}

export function useCalls() {
  return useContext(CallsContext);
}

function CallOverlay() {
  const { session, localStream, remoteStream, isMuted, isCameraOff, acceptCall, declineCall, endCall, toggleMute, toggleCamera } = useCalls();
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => { if (localVideo.current) localVideo.current.srcObject = localStream; }, [localStream]);
  if (!session) return null;

  const isIncoming = session.status === "incoming";
  const isVideo = session.mode === "video";
  const statusLabel = isIncoming ? "مكالمة واردة" : session.status === "ringing" ? "جارٍ الاتصال…" : session.status === "connecting" ? "جارٍ الربط…" : "متصل";
  return <section className={`call-overlay ${isVideo ? "is-video" : "is-audio"}`} aria-label={`${session.mode === "video" ? "اتصال فيديو" : "مكالمة صوتية"} مع ${session.peerName}`}>
    {isVideo && <video ref={remoteVideo} className="call-remote-video" autoPlay playsInline />}
    <div className="call-overlay-shade" />
    <div className="call-overlay-content">
      {isVideo && <video ref={localVideo} className="call-local-video" autoPlay muted playsInline />}
      <div className="call-peer-avatar">{session.peerAvatar ? <img src={session.peerAvatar} alt="" /> : <span>{session.peerName.slice(0, 1)}</span>}</div>
      <p className="call-status">{statusLabel}</p>
      <h2>{session.peerName}</h2>
      <p className="call-mode">{isVideo ? "اتصال فيديو" : "مكالمة صوتية"}</p>
      {!isIncoming && session.status === "ringing" && <div className="call-ringing"><Volume2 size={17} /> ننتظر الرد</div>}
    </div>
    <div className="call-controls">
      {isIncoming ? <>
        <button type="button" className="call-control decline" onClick={declineCall} aria-label="رفض المكالمة"><PhoneOff size={23} /><span>رفض</span></button>
        <button type="button" className="call-control accept" onClick={() => void acceptCall()} aria-label="قبول المكالمة"><Phone size={23} /><span>قبول</span></button>
      </> : <>
        <button type="button" className="call-control neutral" onClick={toggleMute} aria-label={isMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"}>{isMuted ? <MicOff size={22} /> : <Mic size={22} />}</button>
        {isVideo && <button type="button" className="call-control neutral" onClick={toggleCamera} aria-label={isCameraOff ? "تشغيل الكاميرا" : "إيقاف الكاميرا"}>{isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}
        <button type="button" className="call-control decline" onClick={endCall} aria-label="إنهاء المكالمة"><PhoneOff size={23} /><span>إنهاء</span></button>
      </>}
    </div>
  </section>;
}
