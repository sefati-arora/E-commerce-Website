const express = require("express");
const Models = require("../models/index");
Models.orderModel.belongsTo(Models.userModel, {
  foreignKey: "assignDriverId",
  as: "DRIVER DETAILS:",
});
Models.orderModel.hasMany(Models.orderItemModel, { foreignKey: "orderId" });
Models.orderItemModel.belongsTo(Models.productModel, {
  foreignKey: "productId",
});
Models.productModel.hasMany(Models.orderItemModel, { foreignKey: "productId" });
Models.orderModel.belongsTo(Models.addressModel, {
  foreignKey: "addressId",
  as: "USER ADDRESS:",
});
Models.addressModel.hasMany(Models.orderModel, { foreignKey: "addressId" });
Models.orderModel.belongsTo(Models.storeModel, {
  foreignKey: "storeId",
  as: "STORE DETAILS:",
});
Models.storeModel.hasMany(Models.orderModel, { foreignKey: "storeId" });
Models.storeModel.belongsTo(Models.productModel,{foreignKey:'productId',as:'productDetails:'});
Models.productModel.hasMany(Models.storeModel,{foreignKey:'productId'})
module.exports = {
  orders: async (req, res) => {
    try {
      const userId = req.user.id;
      const { orderId } = req.body;
      let active;
      let pending;
      const user = await Models.userModel.findOne({
        where: { id: userId, role: 2 },
      });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      const orders = await Models.orderModel.findOne({
        where: { id: orderId },
        include: [
          {
            model: Models.userModel,
          },
          {
            model: Models.orderItemModel,
            include: [
              {
                model: Models.productModel,
              },
            ],
          },
        ],
      });
      if (orders.status == 1) {
        active = await Models.orderModel.findAndCountAll({
          where: { status: 1 },
        });
      }
      if (orders.status == 0) {
        pending = await Models.orderModel.findAndCountAll({
          where: { status: 0 },
        });
      }
      return res
        .status(200)
        .json({ message: "ORDER COUNT!", orders, active, pending });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productCount: async (req, res) => {
    try {
      const assignDriverId = req.user.id;
      const orders = await Models.orderModel.findAll({
        where: { userId: assignDriverId },
        include: [
          {
            model: Models.orderItemModel,
            include: [Models.productModel],
          },
        ],
      });
      console.log("DRIVER ID", assignDriverId);
      if (!orders || orders.length === 0) {
        return res.status(404).json({ message: "NO ORDERS FOUND!" });
      }
      console.log(JSON.stringify(orders, null, 2));

      const productCount = {};

      // Loop through all orders and their items
      orders.forEach((order) => {
        (order.orderItemTables || []).forEach((item) => {
          const name = item.productTable.title;
          const qty = item.Quantity || 1;

          productCount[name] = (productCount[name] || 0) + qty;
        });
      });

      return res.status(200).json({
        message: "PRODUCT'S FOR DRIVER",
        productCount,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  updateDriverStatus: async (req, res) => {
    try {
      const assignDriverId = req.user.id;
      const { orderId } = req.body;
      const driver = await Models.userModel.findOne({
        where: { id: assignDriverId, role: 2 },
      });
      if (!driver) return res.status(404).json({ message: "NO DRIVER FOUND!" });
      const order = await Models.orderModel.findOne({
        where: { id: orderId },
      });
      let notificationMessage;

      if (order.status === 0) {
        await Models.orderModel.update(
          { status: 1 },
          { where: { id: orderId } }
        );
        notificationMessage = "ORDER ON THE WAY";
        console.log("ORDER on the way");
      } else if (order.status === 1) {
        await Models.orderModel.update(
          { status: 2 },
          { where: { id: orderId } }
        );
        notificationMessage = "ORDER IS ON THE WAY TOWARDS YOUR LOCATION!";
        console.log("ORDER IS ON THE WAY TOWARDS YOUR LOCATION!");
      } else if(order.status === 2){
        console.log('ORDER DELIVERED!')
      }
      else
      {
        console.log("something went wrong here!")
      }
      const notification = await Models.notificationModel.create({
        senderId: assignDriverId,
        receiverId: order.userId,
        message: notificationMessage,
      });
      console.log(notification);

      const updatedOrder = await Models.orderModel.findOne({
        where: { id: orderId },
         include: [
          {
            model: Models.userModel,
            as: "DRIVER DETAILS:",
          },
          {
            model: Models.addressModel,
            as: "USER ADDRESS:",
          },
          {
            model: Models.storeModel,
            as: "STORE DETAILS:",
            include:[{
                model:Models.productModel,
                as:"productDetails:"
            }]
          },
        ],
      });

      return res
        .status(200)
        .json({ message: "ORDER TRACKER", updatedOrder ,order});
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
};
