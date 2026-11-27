import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: "categories" })
export class Category {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  name!: string;

  @Prop({ trim: true })
  image?: string;

  @Prop({ required: true, min: 0, default: 0 })
  displayOrder!: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
CategorySchema.index({ restaurantId: 1, displayOrder: 1 });
