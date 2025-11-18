require("dotenv").config();
const Models = require("../models/index");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const helper = require("../helper/validation");
const commonhelper = require("../helper/commonHelper");
const argon2 = require("argon2");
const otpManager = require("node-twillo-otp-manager")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
  process.env.TWILIO_SERVICE_SID
);
Models.cartManageModel.hasMany(Models.cartModel, { foreignKey: "cartId" });
Models.cartModel.belongsTo(Models.cartManageModel, { foreignKey: "cartId" });
Models.cartModel.belongsTo(Models.productModel, { foreignKey: "productId" });
Models.productModel.hasMany(Models.cartModel, { foreignKey: "productId" });
Models.orderItemModel.belongsTo(Models.orderModel,{foreignKey:"orderId"});
Models.orderModel.hasMany(Models.orderItemModel,{foreignKey:"orderId"})
module.exports = {
  sidIdGenerateTwilio: async (req, res) => {
    try {
      const serviceSid = await otpManager.createServiceSID("Test", "4");
      console.log("Service SID created:", serviceSid);
      return serviceSid;
    } catch (error) {
      console.error("Error generating Service SID:", error);
      throw new Error("Failed to generate Service SID");
    }
  },
  signUp: async (req, res) => {
    try {
      const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        phoneNumber: Joi.string().required(),
        countryCode: Joi.string().required(),
        email: Joi.string().required(),
        password: Joi.string().required(),
        devicetoken: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const {
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        email,
        password,
        devicetoken,
      } = payload;
      const hashpassword = await argon2.hash(password);
      const file = req.files?.profile;
      if (!file) {
        return res.status(400).json({ message: "Profile image is required" });
      }

      const path = await commonhelper.fileUpload(file);

      const user = await Models.userModel.create({
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        email,
        password: hashpassword,
        devicetoken,
        profile: path,
      });
      //    if (user) {
      //   const phone = payload.countryCode + payload.phoneNumber;
      //   let response = await otpManager.sendOTP(phone);
      //   console.log(`✅ OTP sent successfully to ${payload.phoneNumber}`);
      //   console.log(response);
      // }
      const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY);
      return res.status(200).json({ message: "USER CREATED!", user, token });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  login: async (req, res) => {
    try {
      const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { email, password } = payload;
      const hashpassword = await argon2.hash(password);
      const user = await Models.userModel.create({
        email,
        password: hashpassword,
      });
      const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY);
      return res.status(200).json({ message: "USER LOGIN", user, token });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  logOut: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await Models.userModel.findOne({ where: { id: userId } });
      if (user) {
        await Models.userModel.update(
          { devicetoken: null },
          { where: { id: userId } }
        );
      }
      return res.status(200).json({ message: "USER LOGOUT!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  userDelete: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await Models.userModel.destroy({ where: { id: userId } });
      return res.status(200).json({ message: "USER DELETED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERRROR", error });
    }
  },
  forgetpassword: async (req, res) => {
    try {
      const schema = Joi.object({
        email: Joi.string()
          .email({ tlds: { allow: ["com", "net", "org", "in", "us"] } })
          .required()
          .label("Email"),
        password: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { email, password } = payload;
      const otp = Math.floor(1000 + Math.random() * 9000);
      const hashpassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      const user = await Models.userModel.create({
        email,
        password: hashpassword,
      });
      try {
        await commonhelper.otpSendLinkHTML(req, email, otp);
        console.log(`OTP sent (${email}): ${otp}`);
      } catch (error) {
        await Models.userModel.destroy({ where: { id: user.id } });
        return res.status(400).json({ message: "Failed to send OTP" });
      }
      return res.status(200).json({ message: "NEW PASSWORD CREATED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  changePassword: async (req, res) => {
    try {
      const schema = Joi.object({
        oldpassword: Joi.string().required(),
        newpassword: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref("newpassword")).required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { oldpassword, newpassword } = payload;
      const id = req.user.id;
      const user = await Models.userModel.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      console.log("hash", user.password);
      console.log(">>>>", oldpassword);
      const validpassword = await argon2.verify(
        user.password,
        oldpassword.trim()
      );
      if (!validpassword) {
        return res.status(404).json({ message: "INVALID PASSWORD" });
      }
      const hashedPassword = await argon2.hash(newpassword, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      const existuser = await Models.userModel.update(
        { password: hashedPassword },
        { where: { id: id } }
      );
      return res.status(200).json({ message: "PASSWORD CHANGED!", existuser });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  editProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      console.log(">>>", userId);
      const { firstName, lastName, phoneNumber, countryCode, email, profile } =
        req.body;
      const user = await Models.userModel.findOne({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      let profilepath = user.profile;
      if (req.files?.profile) {
        const file = req.files.profile;
        profilepath = await commonhelper.fileUpload(file);
      }
      await Models.userModel.update(
        { firstName, lastName, phoneNumber, countryCode, email, profile },
        { where: { id: userId } }
      );
      return res.status(200).json({ message: "USER DATA UPDATED", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  clearNotification: async (req, res) => {
    try {
      const { notificationId } = req.body;
      const notify = await Models.notificationModel.findOne({
        where: { notificationId },
      });
      if (notify) {
        await Models.notificationModel.destroy({ where: { notificationId } });
      }
      return res.status(200).json({ message: "NOTIFICATION CLEAR" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  address: async (req, res) => {
    try {
      const userId = req.user.id.trim();
      const schema = Joi.object({
        country: Joi.string().required(),
        state: Joi.string().required(),
        city: Joi.string().required(),
        hnumber: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const users = await Models.userModel.findOne({ where: { id: userId } });
      if (!users) {
        return res.status(404).json({ message: "USER NOT FOUND" });
      }

      const user = await Models.addressModel.create({
        userId,
        country: payload.country,
        state: payload.state,
        city: payload.city,
        hnumber: payload.hnumber,
      });
      return res.status(200).json({ message: "ADDRESS ADDED!", user, users });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  editAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId, country, state, city, hnumber } = req.body;
      const userexist = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      if (!userexist) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      await Models.addressModel.update(
        { country, state, city, hnumber },
        { where: { id: addressId, userId } }
      );
      return res.status(200).json({ message: "DATA UPDATED!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  deleteAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.body;
      const user = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND" });
      }
      await Models.addressModel.destroy({ where: { id: addressId, userId } });
      return res.status(200).json({ message: "ADDRESS DELETED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  cartData: async (req, res) => {
    try {
      const schema = Joi.object({
        productId: Joi.string().required(),
        Quantity: Joi.number().required(),
      
      });
      const payload = await helper.validationJoi(req.body, schema);
      const user = await Models.cartModel.create({
        productId: payload.productId,
        Quantity: payload.Quantity,
       
      });
      return res.status(200).json({ message: "YOU PRODUCT ADDED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  cartDataDeleted: async (req, res) => {
    try {
      const { cartId } = req.body;
      const cart = await Models.cartModel.findOne({ where: { id: cartId } });
      if (!cart) {
        return res.status(404).json({ message: "CART DATA NOT FOUND!" });
      }
      await Models.cartModel.destroy({ where: { id: cartId } });
      return res.status(200).json({ message: "CART DATA DELETED!", cart });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  bookingCreate: async (req, res) => {
    try {
      const userId =req.user.id
      const schema = Joi.object({
        cartId: Joi.string().required(),
        addressId: Joi.string().required(),
        time: Joi.string().required(),
        bookingId: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const defaultAddress = await Models.addressModel.findOne({
        where: { id: payload.addressId, userId:userId, isDefault: 1 },
      });

      if (!defaultAddress) {
        return res.status(400).json({
          message: "Invalid address selected",
        });
      }
      const booking = await Models.bookingModel.create({
        userId,
        cartId: payload.cartId,
        addressId: payload.addressId,
      });
      const slot = await Models.bookingSlot.create({
        userId,
        bookingId: booking.id,
        time: payload.time,
      });
      return res
        .status(200)
        .json({ message: "BOOKING CREATED!", booking, slot });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  bookingDeleted: async (req, res) => {
    try {
      const { bookingId } = req.body;
      const booking = await Models.bookingModel.findOne({
        where: { id: bookingId },
      });
      if (!booking) {
        return res.status(404).json({ message: "BOOKING NOT FOUND!" });
      }
      await Models.bookingModel.destroy({ where: { id: bookingId } });
      return res.status(200).json({ message: "DATA DELETED!", booking });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  getproduct: async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(404).json({ message: "ID NOT FOUND!" });
      }
      const product = await Models.productModel.findOne({
        where: { id: productId },
      });
      if (!product) {
        return res.status(404).json({ message: "PRODUCT NOT FOUND!" });
      }
      return res.status(200).json({ message: "PRODUCT DATA GET!", product });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  addressDefault: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.body;
      const user = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      if (!user) {
        return res.status(404).json({ message: "USER ADDRESS NOT FOUND" });
      }
      await Models.addressModel.update(
        { isDefault: 1 },
        { where: { id: addressId } }
      );
      const update = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      return res.status(200).json({ message: "ADDRESS DEFAULT SET!", update });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  subscriptionCreate:async(req,res) =>
  {
    try
    {
       const schema=Joi.object({
        title:Joi.string().required(),
        subscriptionType:Joi.string().required(),
        Amount:Joi.string().required(),
        description:Joi.string().required()
       });
       const payload=await helper.validationJoi(req.body,schema)
       const{title,subscriptionType,Amount,description}=payload;
       const user=await Models.subscriptionModel.create({
        title,
        subscriptionType,
        Amount,
        description
       })
       return res.status(200).json({message:"SUBSCRIPTION CREATED!",user})
    }
    catch(error)
    {
       console.log(error)
       return res.status(500).json({message:"error",error})
    }
  },
  subscriptionEdit:async(req,res) =>
  {
   try
   {
     const{subscriptionId,title,subscriptionType,Amount,description}=req.body;
     const sub=await Models.subscriptionModel.findOne({where:{id:subscriptionId}})
     if(!sub)
     {
      return res.status(404).json({message:"SUBSCRIPTION NOT FOUND!"})
     }
     await Models.subscriptionModel.update({title,subscriptionType,Amount,description},{where:{id:subscriptionId}})
     return res.status(200).json({message:"SUBSCRIPTION UPDATED!"})
   }
   catch(error)
   {
    console.log(error)
    return res.status(500).json({message:"ERROR",error})
   }
  },
  subscriptionDelete:async(req,res)=>
  {
     try
     {
       const{subscriptionId}=req.body;
       const sub=await Models.subscriptionModel.findOne({where:{id:subscriptionId}})
       if(!sub)
       {
          return res.status(404).json({message:"SUBSCRIPTION NOT FOUND!"})
       }
       await Models.subscriptionModel.destroy({where:{id:subscriptionId}})
       return res.status(200).json({message:"SUBSCRIPTION ID DELETED!"})
     }
     catch(error)
     {
      console.log(error)
      return res.status(500).json({message:"ERROR",error})
     }
  },
  subscriptionBuy:async(req,res) =>
  {
    try
    {
       const userId=req.user.id;
       const{subscriptionId}=req.body;
       const subscriptionBuy=await Models.subscriptionModel.findOne({where:{id:subscriptionId}})
       if(!subscriptionBuy)
       {
        return res.status(404).json({message:"SUBSCRIPTION NOT FOUND!"})
       }
       const startDate=new Date();
       const EndDate=new Date(startDate);
       if(subscriptionBuy.subscriptionType==0)
       {
         EndDate.setMonth(EndDate.getMonth()+1)
       }
       else if(subscriptionBuy.subscriptionType==1)
       {
        EndDate.setFullYear(EndDate.getFullYear()+1)
       }
       else
       {
        return res.status(404).json({message:"ERROR INVALID SUBSCRIPTION!"})
       }
       const sub=await Models.subscriptionBuyModel.create({
        userId,
        subscriptionId,
        startDate:startDate,
        EndDate:EndDate
       })
       return res.status(200).json({message:"SUBSCRIPTION BUY",sub})
    }
    catch(error)
    {
      console.log(error)
      return res.status(500).json({message:"ERROR",error})
    }
  },
   AddCartItem:async(req,res) =>
   {
    try
    {
       const userId=req.user.id;
       const{productId,Quantity}=req.body;
       if(!productId||!Quantity)
       {
        return res.status(404).json({message:"prodctId and quantity not found!"})
       }
       let user=await Models.cartManageModel.findOne({where:{userId}})
       if(!user)
       {
        user= await Models.cartManageModel.create(
          {
            userId
          }
        )
       }
         const existuser=await Models.cartModel.findOne({where:{cartId:user.id,productId}})
         if(existuser)
         {
          existuser.Quantity += Number(Quantity);
          await existuser.save()
         }
         else
         {
          await Models.cartModel.create({
            cartId:user.id,
            productId,
            Quantity
          })
         }
         const cartData = await Models.cartManageModel.findOne({
        where: {id:user.id},
        include: [
          {
            model: Models.cartModel,
            include: [
              {
                model: Models.productModel,
              },
            ],
          },
        ],
      });
       return res.status(200).json({message:"CART CREATED",existuser,cartData})
    }
    catch(error)
    {
      console.log(error)
      return res.status(500).json({message:"ERROR",error})
    }
   },
 UpdateCart: async (req, res) => {
  try {
    const userId = req.user.id;
    const { cartItemId, Quantity } = req.body;
    const userCart = await Models.cartManageModel.findOne({ where: { userId } });
    if (!userCart) {
      return res.status(404).json({ message: "USER NOT FOUND!" });
    }
    const cartItem = await Models.cartModel.findOne({ 
      where: { cartId: userCart.id, id: cartItemId } 
    });
    if (!cartItem) {
      return res.status(404).json({ message: "CART ITEM NOT FOUND!" });
    }
    const updatedRows = await Models.cartModel.update(
      { Quantity },
      { where: { cartId: userCart.id, id:cartItemId } }
    );
    return res.status(200).json({ message: "CART UPDATED!", updatedRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "ERROR", error });
  }
},
   DeleteCart:async(req,res)=>
   {
    try
    {
      const{cartItemId}=req.body;
      let cart=await Models.cartModel.findOne({where:{id:cartItemId}})
      if(cart)
      {
        cart=await Models.cartModel.destroy({where:{id:cartItemId}})
      }
      else
      {
        return res.status(404).json({message:"CART ITEM NOT FOUND!"})
      }
      return res.status(200).json({message:"DATA DELETED!",cart})
    }
    catch(error)
    {
      console.log(error)
      return res.status(500).json({message:"ERROR",error})
    }
   },
checkout: async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.body;

    if (!addressId) return res.status(404).json({ message: "ADDRESS REQUIRED!" });

    const address = await Models.addressModel.findOne({ where: { id: addressId, userId } });
    if (!address) return res.status(404).json({ message: "Invalid data!" });

    const cart = await Models.cartManageModel.findOne({
      where: { userId },
      include: [
        {
          model: Models.cartModel,
          include: [Models.productModel], // each cart item will have productModel
        },
      ],
    });

    console.log("======", cart);

    if (!cart || cart.cartTables.length === 0) // <-- use cartTabless
      return res.status(404).json({ message: "Cart is empty" });
    // Calculate total
    let total = 0;
    cart.cartTables.forEach(item => {
      total += item.Quantity * item.productTable.price;
    });
    // Create order
    const order = await Models.orderModel.create({
      userId,
      addressId,
      Amount: total,
      status: 0,
    });

    // Create order items
for(let items of cart.cartTables)
      {
        await Models.orderItemModel.create({
  orderId: order.id,
  userId,
  addressId,
  productId: items.productId,
  Quantity: items.Quantity,
  price: items.productTable.price,
});
      }
     
    // Clear cart items
    // await Models.cartModel.destroy({ where: { cartId: cart.id } });

    return res.status(200).json({ message: "Order placed successfully", orderId: order.id, totalAmount: total,cart});
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "ERROR", error });
  }
},
orderList:async(req,res)=>
{
  try
  {
   
    const order=await Models.orderModel.findAll({
    include:[
      {
        model:Models.orderItemModel
      }
    ]})
    return res.status(200).json({message:"ORDER GET!",order})
  }
  catch(error)
  {
    console.log(error)
    return res.status(500).json({message:"ERROR",error})
  }
},
orderDetails:async(req,res) =>
{
  try
  {
    const{orderId}=req.body;
    const order=await Models.orderModel.findOne({where:{id:orderId},
    include:[
      {
          model:Models.orderItemModel
      }
    ]})
   
    return res.status(200).json({message:"ORDER'S DETAILS GET!",order})
  }
  catch(error)
  {
    console.log(error)
    return res.status(500).json({message:"ERROR",error})
  }
}

}
