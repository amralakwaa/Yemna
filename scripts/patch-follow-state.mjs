import fs from "node:fs";

const path = "client/src/pages/SocialSuite.tsx";
let source = fs.readFileSync(path, "utf8");
const old = 'const[following,setFollowing]=useState<string[]>([]);const { isAuthenticated: signedIn } = useCurrentUser();';
const next = 'const[following,setFollowing]=useState<Record<string,boolean>>({});const { isAuthenticated: signedIn } = useCurrentUser();';
if (!source.includes(old)) throw new Error("following state anchor not found");
source = source.replace(old, next);
const oldToggle = 'const active=following.includes(id);if(active){await api.unfollowUser(id);setFollowing(old=>old.filter(item=>item!==id));toast.success("تم إلغاء المتابعة")}else{await api.followUser(id);setFollowing(old=>[...old,id]);toast.success("تمت المتابعة")}};';
const newToggle = 'const active=following[id] ?? false;if(active){await api.unfollowUser(id);setFollowing(old=>({...old,[id]:false}));toast.success("تم إلغاء المتابعة")}else{await api.followUser(id);setFollowing(old=>({...old,[id]:true}));toast.success("تمت المتابعة")}};';
if (!source.includes(oldToggle)) throw new Error("toggle anchor not found");
source = source.replace(oldToggle, newToggle);
const oldLabel = 'const isFollowing=following.includes(user.id)||user.isFollowing;';
const newLabel = 'const isFollowing=following[user.id] ?? user.isFollowing;';
if (!source.includes(oldLabel)) throw new Error("label anchor not found");
source = source.replace(oldLabel, newLabel);
fs.writeFileSync(path, source);
