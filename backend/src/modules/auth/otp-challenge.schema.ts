import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type OtpChallengeDocument = HydratedDocument<OtpChallenge>;

@Schema({ timestamps: true, collection: "otp_challenges" })
export class OtpChallenge {
  @Prop({ required: true, trim: true })
  phoneNumber!: string;

  @Prop({ required: true, select: false })
  otpHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  @Prop({ required: true, default: 0 })
  requestCount!: number;

  @Prop({ required: true, default: Date.now })
  requestWindowStartedAt!: Date;

  @Prop({ required: true, default: Date.now })
  lastRequestedAt!: Date;
}

export const OtpChallengeSchema = SchemaFactory.createForClass(OtpChallenge);
OtpChallengeSchema.index({ phoneNumber: 1 }, { unique: true });
OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
