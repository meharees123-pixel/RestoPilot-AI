import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateRestaurantDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "doha-kitchen", maxLength: 80 })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(80)
  slug!: string;

  @ApiProperty({ example: "+97455112233" })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  restaurantWhatsappNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  ownerFirstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  ownerLastName!: string;

  @ApiProperty({ example: "+97455112233" })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  ownerPhoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}
