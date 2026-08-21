import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SearchQueryDto } from "./dto/search.dto";
import { SearchService } from "./search.service";
@ApiTags("search")
@Controller({ path: "search", version: "1" })
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q, query.type, query.page ?? 1, query.limit ?? 30);
  }
}
