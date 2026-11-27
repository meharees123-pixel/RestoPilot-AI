const mongoose = require("mongoose");

const { Restaurant, RestaurantSchema } = require("../dist/modules/tenant/schemas/restaurant.schema");
const { User, UserSchema } = require("../dist/modules/auth/user.schema");
const { Branch, BranchSchema } = require("../dist/modules/branch/schemas/branch.schema");
const { Category, CategorySchema } = require("../dist/modules/menu/schemas/category.schema");
const { MenuItem, MenuItemSchema } = require("../dist/modules/menu/schemas/menu-item.schema");
const { Customer, CustomerSchema } = require("../dist/modules/customer/customer.schema");
const { Order, OrderSchema } = require("../dist/modules/order/order.schema");
const { OrderCounter, OrderCounterSchema } = require("../dist/modules/order/order-counter.schema");
const definitions = [
  [Restaurant.name, RestaurantSchema],
  [User.name, UserSchema],
  [Branch.name, BranchSchema],
  [Category.name, CategorySchema],
  [MenuItem.name, MenuItemSchema],
  [Customer.name, CustomerSchema],
  [Order.name, OrderSchema],
  [OrderCounter.name, OrderCounterSchema],
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
