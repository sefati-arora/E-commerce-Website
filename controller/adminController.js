require("dotenv").config();
const Models = require("../models/index");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const helper = require("../helper/validation");
const commonhelper = require("../helper/commonHelper");
module.exports = {
  category: async (req, res) => {
    try {
      const schema = Joi.object({
        title: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const file = req.files?.profile;
      if (!file) {
        return res.status(400).json({ message: "Profile image is required" });
      }

      const path = await commonhelper.fileUpload(file);
      const user = await Models.categoryModel.create({
        title: payload.title,
        categoryImage: path,
      });
      return res.status(200).json({ message: "CATEGORY CREATED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  editCategory: async (req, res) => {
    try {
      const { categoryId, title, categoryImage } = req.body;
      const category = await Models.categoryModel.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(404).json({ message: "CATEGORY NOT FOUND!" });
      }
      let categoryImagePath = category.categoryImage;
      if (req.files?.categoryImage) {
        const file = req.files.categoryImage;
        categoryImagePath = await commonhelper.fileUpload(file);
      }
      await Models.categoryModel.update(
        { title, categoryImage },
        { where: { id: categoryId } }
      );
      return res.status(200).json({ message: "DATA UPDATED!", category });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  deleteCategory: async (req, res) => {
    try {
      const { categoryId } = req.body;
      const category = await Models.categoryModel.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(404).json({ message: "CATEGORY NOT FOUND!" });
      }
      await Models.categoryModel.destroy({ where: { id: categoryId } });
      return res.status(200).json({ message: "CATEGORY DELETED!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productAdded: async (req, res) => {
    try {
      const schema = Joi.object({
        categoryId: Joi.string().required(),
        title: Joi.string().required(),
        description: Joi.string().required(),
        price: Joi.string().required(),
        status: Joi.number().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const product = await Models.productModel.create({
        categoryId: payload.categoryId,
        title: payload.title,
        description: payload.description,
        price: payload.price,
        status: payload.status,
      });
      return res.status(200).json({ message: "PRODUCT ADDED!", product });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  productEdit: async (req, res) => {
    try {
      const { productId, categoryId, title, description, price, status } =
        req.body;
      const product = await Models.productModel.findOne({
        where: { id: productId },
      });
      if (!product) {
        return res.status(404).json({ message: "PRODUCT NOT FOUND!" });
      }
      await Models.productModel.update(
        { categoryId, title, description, price, status },
        {
          where: { id: productId },
        }
      );
      return res.status(200).json({ messagee: "PRODUCT EDIT!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  deleteProduct: async (req, res) => {
    try {
      const { productId } = req.body;
      const product = await Models.productModel.findOne({
        where: { id: productId },
      });
      if (!product) {
        return res.status(404).json({ message: "PRODUCT NOT FOUND!" });
      }
      await Models.productModel.destroy({ where: { id: productId } });
      return res.status(200).json({ message: " PRODUCT DELETED!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productImage: async (req, res) => {
    try {
      const { productId } = req.body;
      const product = await Models.productModel.findOne({
        where: { id: productId },
      });
      if (!product) {
        return res.status(404).json({ message: "PRODUCT ID NOT FOUND" });
      }
      let file = req.files?.file;
      if (!file) {
        return res.status(404).json({ message: "FILE NOT FOUND" });
      }
      if (!Array.isArray(file)) {
        file = [file];
      }
      for (let i = 0; i < file.length; i++) {
        const path = await commonhelper.fileUpload(file[i]);
        await Models.productImage.create({
          productId,
          Images: path,
        });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productImageEdit: async (req, res) => {
    try {
      const { productId, ImageId } = req.body;
      const productImage = await Models.productImage.findOne({
        where: { id: ImageId, productId },
      });
      if (!productImage) {
        return res.status(404).json({ message: "IMAGE NOT FOUND!" });
      }
      let imagePath = productImage.Images;
      if (req.file) {
        imagePath = await commonhelper.fileUpload(req.file);
      }
      await Models.productImage.update(
        { Images: imagePath },
        { where: { id: ImageId } }
      );

      return res
        .status(200)
        .json({ message: "IMAGE UPDATED!", image: updatedImage });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productImageDelete:async(req,res) =>
  {
    try
    { 
      const{productId,ImageId}=req.body;
      const product=await Models.productImage.findOne({where:{productId,ImageId}})
      if(!product)
      {
        return res.status(404).json({message:"PRODUCT IMAGE NOT FOUND!"})
      }
      await Models.productImage.destroy({where:{id:productId,ImageId}})
      return res.status(200).json({message:"DATA DESTROY!",product})
    }
    catch(error)
    {
        console.log(error)
        return res.status(500).json({message:"ERROR",error})
    }
  }
};
