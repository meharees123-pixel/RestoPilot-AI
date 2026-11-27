import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { BranchStatus } from "./schemas/branch.schema";

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRadius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleMapUrl?: string;
}

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: BranchStatus })
  @IsEnum(BranchStatus)
  status!: BranchStatus;
}
