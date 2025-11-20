const Sequelize=require("sequelize");
const sequelize=require('../config/connectdb').sequelize;

module.exports=
{
     userModel:require('./userModel')(Sequelize,sequelize,Sequelize.DataTypes),
     categoryModel:require('./categoryModel')(Sequelize,sequelize,Sequelize.DataTypes),
     productModel:require('./productModel')(Sequelize,sequelize,Sequelize.DataTypes),
     productImage:require('./productImage')(Sequelize,sequelize,Sequelize.DataTypes),
     cartModel:require("./cartModel")(Sequelize,sequelize,Sequelize.DataTypes),
     bookingModel:require('./bookingModel')(Sequelize,sequelize,Sequelize.DataTypes),
     addressModel:require('./addressModel')(Sequelize,sequelize,Sequelize.DataTypes),
     notificationModel:require('./notificationModel')(Sequelize,sequelize,Sequelize.DataTypes),
     transationModel:require('./transationModel')(Sequelize,sequelize,Sequelize.DataTypes),
     bookingSlot:require('./bookingSlot')(Sequelize,sequelize,Sequelize.DataTypes),
     subscriptionModel:require('./subscriptionModel')(Sequelize,sequelize,Sequelize.DataTypes),
     subscriptionBuyModel:require('./subscriptionBuyModel')(Sequelize,sequelize,Sequelize.DataTypes),
     cartManageModel:require('./cartManageModel')(Sequelize,sequelize,Sequelize.DataTypes),
     orderModel:require('./orderModel')(Sequelize,sequelize,Sequelize.DataTypes),
     orderItemModel:require('./orderItemModel')(Sequelize,sequelize,Sequelize.DataTypes),
     storeModel:require('./storeModel')(Sequelize,sequelize,Sequelize.DataTypes),
     productReviewModel:require('./productReviewModel')(Sequelize,sequelize,Sequelize.DataTypes),
     likeModel:require('./likeModel')(Sequelize,sequelize,Sequelize.DataTypes),
}