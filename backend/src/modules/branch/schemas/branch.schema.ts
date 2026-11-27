import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type BranchDocument = HydratedDocument<Branch>;

export enum BranchStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ required: true, enum: ["Point"], default: "Point" })
  type!: "Point";

  @Prop({ required: true, type: [Number], validate: (coordinates: number[]) =>
    coordinates.length === 2 })
  coordinates!: [number, number];
}

export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ timestamps: true, collection: "branches" })
export class Branch {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  address!: string;

  @Prop({ type: GeoPointSchema })
  location?: GeoPoint;

  @Prop({ min: -90, max: 90 })
  latitude?: number;

  @Prop({ min: -180, max: 180 })
  longitude?: number;

  @Prop({ min: 0 })
  deliveryRadius?: number;

  @Prop({ trim: true })
  googleMapUrl?: string;

  @Prop({ required: true, enum: BranchStatus, default: BranchStatus.ACTIVE })
  status!: BranchStatus;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
BranchSchema.index({ location: "2dsphere" });
