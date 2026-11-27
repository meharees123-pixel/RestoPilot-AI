import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { DeliveryType, OrderStatus } from "./order.schema";

export class OrderLineDto {
  @ApiProperty()
  @IsString()
  menuItemId!: string;

  @ApiProperty({ minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  branchId!: string;

  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];

  @ApiProperty({ enum: ["cash", "card", "online"] })
  @IsEnum(["cash", "card", "online"])
  paymentMethod!: "cash" | "card" | "online";

  @ApiProperty({ enum: DeliveryType })
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
