const mongoose = require("mongoose");
const path = require("node:path");

try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"));
} catch (error) {
  if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
}

const { Restaurant, RestaurantSchema } = require("../dist/src/modules/tenant/schemas/restaurant.schema");
const { User, UserSchema } = require("../dist/src/modules/auth/user.schema");
const { Branch, BranchSchema } = require("../dist/src/modules/branch/schemas/branch.schema");
const { Category, CategorySchema } = require("../dist/src/modules/menu/schemas/category.schema");
const { MenuItem, MenuItemSchema } = require("../dist/src/modules/menu/schemas/menu-item.schema");
const { Customer, CustomerSchema } = require("../dist/src/modules/customer/customer.schema");
const { Order, OrderSchema } = require("../dist/src/modules/order/order.schema");
const { OrderCounter, OrderCounterSchema } = require("../dist/src/modules/order/order-counter.schema");
const { OtpChallenge, OtpChallengeSchema } = require("../dist/src/modules/auth/otp-challenge.schema");
const { AccessAudit, AccessAuditSchema } = require("../dist/src/modules/audit/access-audit.schema");
const {
  WhatsappMessage,
  WhatsappMessageSchema,
} = require("../dist/src/modules/whatsapp/schemas/whatsapp-message.schema");
const definitions = [
  [Restaurant.name, RestaurantSchema],
  [User.name, UserSchema],
  [Branch.name, BranchSchema],
  [Category.name, CategorySchema],
  [MenuItem.name, MenuItemSchema],
  [Customer.name, CustomerSchema],
  [Order.name, OrderSchema],
  [OrderCounter.name, OrderCounterSchema],
  [OtpChallenge.name, OtpChallengeSchema],
  [AccessAudit.name, AccessAuditSchema],
  [WhatsappMessage.name, WhatsappMessageSchema],
];

async function createIndexes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must be configured");

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DATABASE || "RestoPilot",
    autoIndex: false,
  });
  try {
    const models = definitions.map(([name, schema]) => mongoose.model(name, schema));
    const userModel = models.find((model) => model.modelName === User.name);
    const indexes = await userModel.collection.indexes();
    const legacyEmailIndex = indexes.find(
      (index) => index.key.email === 1 && index.unique && !index.partialFilterExpression,
    );
    if (legacyEmailIndex) await userModel.collection.dropIndex(legacyEmailIndex.name);
    await Promise.all(models.map((model) => model.createIndexes()));
    process.stdout.write(`Ensured indexes for ${models.length} collections\n`);
  } finally {
    await mongoose.disconnect();
  }
}

createIndexes().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
