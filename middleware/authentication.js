const jwt = require("jsonwebtoken");
const secretKey = process.env.SECRET_KEY;
const Models = require("../models/index");

module.exports = {
  authentication: async (req, res, next) => {
    let token = req.headers["authorization"];
    token = token.startsWith("Bearer ") ? token.split(" ")[1] : token;

    if (token) {
      jwt.verify(token, secretKey, async (err, authData) => {
        if (err) {
          return res.status(401).json({message:"invalid token"})
        }
        let userDetail = await Models.userModel.findOne({
          where: { id: authData.id },
          raw: true,
        });
        req.user = userDetail;
        req.token = token;
        next();
      });
    } else {
      return res.status(404).json({message:"Forgot password token verification error:"})
    }
  },
}