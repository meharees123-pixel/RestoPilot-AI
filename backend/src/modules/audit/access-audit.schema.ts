import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { UserRole } from "../auth/user.schema";

export type AccessAuditDocument = HydratedDocument<AccessAudit>;

@Schema({ collection: "access_audits", versionKey: false })
export class AccessAudit {
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  userId!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  restaurantId!: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(UserRole), default: null })
  role!: UserRole | null;

  @Prop({ required: true })
  method!: string;

  @Prop({ required: true })
  path!: string;

  @Prop({ required: true, min: 100, max: 599 })
  statusCode!: number;

  @Prop({ required: true, default: Date.now })
  occurredAt!: Date;
}

export const AccessAuditSchema = SchemaFactory.createForClass(AccessAudit);
AccessAuditSchema.index({ occurredAt: -1 });
AccessAuditSchema.index({ restaurantId: 1, occurredAt: -1 });
AccessAuditSchema.index({ userId: 1, occurredAt: -1 });
