const mongoose = require("mongoose");
const path = require("node:path");

try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"));
} catch (error) {
  if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
}

const { Restaurant, RestaurantSchema, RestaurantStatus } = require("../dist/src/modules/tenant/schemas/restaurant.schema");
const { User, UserRole, UserSchema, UserStatus } = require("../dist/src/modules/auth/user.schema");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

async function seedOwner() {
  const uri = required("MONGODB_URI");
  const firstName = required("SEED_OWNER_FIRST_NAME");
  const lastName = required("SEED_OWNER_LAST_NAME");
  const phoneNumber = required("SEED_OWNER_PHONE_NUMBER");
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() || undefined;
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new Error("SEED_OWNER_PHONE_NUMBER must be in E.164 format");
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DATABASE || "RestoPilot",
  });
  const RestaurantModel = mongoose.model(Restaurant.name, RestaurantSchema);
  const UserModel = mongoose.model(User.name, UserSchema);
  let createdRestaurant;

  try {
    const slug = required("SEED_RESTAURANT_SLUG").toLowerCase();
    let restaurant = await RestaurantModel.findOne({ slug });
    if (!restaurant) {
      restaurant = await RestaurantModel.create({
        name: required("SEED_RESTAURANT_NAME"),
        slug,
        restaurantWhatsappNumber: required("SEED_WHATSAPP_NUMBER"),
        status: RestaurantStatus.ACTIVE,
        subscriptionPlan: "free",
      });
      createdRestaurant = restaurant;
    } else if (restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new Error("The existing restaurant is not active; activate it before inviting an owner");
    }

    const [phoneUser, emailUser] = await Promise.all([
      UserModel.findOne({ phoneNumber }),
      email ? UserModel.findOne({ email }) : Promise.resolve(null),
    ]);
    if (phoneUser && emailUser && !phoneUser._id.equals(emailUser._id)) {
      throw new Error("SEED_OWNER_PHONE_NUMBER and SEED_OWNER_EMAIL belong to different accounts");
    }
    const user = phoneUser || emailUser;
    if (user?.role === UserRole.SUPER_ADMIN) {
      throw new Error("The configured owner identity belongs to a super administrator");
    }
    if (user?.role === UserRole.RESTAURANT_OWNER && user.restaurantId?.equals(restaurant._id)) {
      process.stdout.write(`Owner already provisioned for restaurant ${restaurant.slug}\n`);
      return;
    }
    if (user && (user.role !== "owner" || !user.restaurantId?.equals(restaurant._id))) {
      throw new Error("The configured owner identity belongs to another account or restaurant");
    }

    const ownerFields = {
      firstName,
      lastName,
      phoneNumber,
      ...(email ? { email } : {}),
      role: UserRole.RESTAURANT_OWNER,
      restaurantId: restaurant._id,
      branchIds: [],
      status: UserStatus.INVITED,
      isWhatsappVerified: false,
    };
    if (user) {
      await UserModel.updateOne(
        { _id: user._id },
        { $set: ownerFields, $unset: { passwordHash: 1, mfaSecret: 1, refreshTokenHash: 1 } },
      );
    } else {
      await UserModel.create(ownerFields);
    }
    process.stdout.write(`Invited owner ${firstName} ${lastName} to restaurant ${restaurant.slug}\n`);
  } catch (error) {
    if (createdRestaurant) await RestaurantModel.deleteOne({ _id: createdRestaurant._id });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

seedOwner().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
