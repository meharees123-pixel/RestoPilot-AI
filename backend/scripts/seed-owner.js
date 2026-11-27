const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const { Restaurant, RestaurantSchema, RestaurantStatus } = require("../dist/modules/tenant/schemas/restaurant.schema");
const { User, UserRole, UserSchema } = require("../dist/modules/auth/user.schema");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

async function seedOwner() {
  const uri = required("MONGODB_URI");
  const email = required("SEED_OWNER_EMAIL").trim().toLowerCase();
  const password = required("SEED_OWNER_PASSWORD");
  if (password.length < 12 || password.length > 128) {
    throw new Error("SEED_OWNER_PASSWORD must be between 12 and 128 characters");
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DATABASE || "RestoPilot",
  });
  const RestaurantModel = mongoose.model(Restaurant.name, RestaurantSchema);
  const UserModel = mongoose.model(User.name, UserSchema);
  let restaurant;

  try {
    if (await UserModel.exists({ email })) {
      throw new Error("An account with SEED_OWNER_EMAIL already exists");
    }

    restaurant = await RestaurantModel.create({
      name: required("SEED_RESTAURANT_NAME"),
      slug: required("SEED_RESTAURANT_SLUG").toLowerCase(),
      restaurantWhatsappNumber: required("SEED_WHATSAPP_NUMBER"),
      status: RestaurantStatus.ACTIVE,
      subscriptionPlan: "free",
    });

    await UserModel.create({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.OWNER,
      restaurantId: restaurant._id,
      branchIds: [],
      isActive: true,
    });
    process.stdout.write(`Created owner account ${email} for restaurant ${restaurant.slug}\n`);
  } catch (error) {
    if (restaurant) await RestaurantModel.deleteOne({ _id: restaurant._id });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

seedOwner().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
