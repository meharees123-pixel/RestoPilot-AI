import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { Types } from "mongoose";

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[\da-f]{24}$/i.test(value) || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException("Invalid identifier");
    }
    return value;
  }
}
