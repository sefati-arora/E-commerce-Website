require("dotenv").config();
const Models = require("../models/index");
const Joi = require("joi");
const helper = require("../helper/validation");
const commonhelper = require("../helper/commonHelper");
module.exports = {
  category: async (req, res) => {
    try {
      const schema = Joi.object({
        title: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const file = req.files?.categoryImage;
      if (!file) {
        return res.status(400).json({ message: "Category image is required" });
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
      const { categoryId, title } = req.body;
      const category = await Models.categoryModel.findOne({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(404).json({ message: "CATEGORY NOT FOUND!" });
      }
      let categorypath = req.files?.categoryImage;
      if (req.files?.categoryImage) {
        const file = req.files.categoryImage;
        categorypath = await commonhelper.fileUpload(file);
      }
      await Models.categoryModel.update(
        { title, categoryImage: categorypath },
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
      const categoryId = req.body.categoryId.trim();
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
      });
      const payload = await helper.validationJoi(req.body, schema);
      let file = req.files?.file;
      console.log(">>>>", file);
      if (!file) {
        return res.status(404).json({ message: "FILE NOT FOUND" });
      }
      if (!Array.isArray(file)) {
        file = [file];
      }
      const product = await Models.productModel.create({
        categoryId: payload.categoryId,
        title: payload.title,
        description: payload.description,
        price: payload.price,
      });
      for (let i = 0; i < file.length; i++) {
        const path = await commonhelper.fileUpload(file[i]);
        await Models.productImage.create({
          Images: path,
        });
      }

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
      let file = req.files?.file;
      console.log(">>>>", file);
      if (!file) {
        return res.status(404).json({ message: "FILE NOT FOUND" });
      }
      if (!Array.isArray(file)) {
        file = [file];
      }
      await Models.productModel.update(
        { categoryId, title, description, price, status },
        {
          where: { id: productId },
        });
        for (let i = 0; i < file.length; i++) {
        const path = await commonhelper.fileUpload(file[i]);
        await Models.productImage.update({
          Images: path,
        },{where:{id:productId}});
    }
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
};
