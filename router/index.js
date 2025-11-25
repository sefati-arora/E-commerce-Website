var express = require("express");
var router = express.Router();
const commonHelper = require("../helper/commonHelper");

router.get("/", (req, res) => {
  res.render("index", { title: "Express" });
});
// router.get("/user", async (req, res) => {
//   let jsonData = require("../config/userSwagger.json");
//   delete jsonData.host;
//   jsonData.host = await commonHelper.getHost(req, res); // Dynamically set the host
//   console.log("jsonData.host:  ", jsonData.host);
//   return res.status(200).send(jsonData);
// });
router.get("/api", async (req, res) => {
  let jsonData = require("../config/driverSwagger.json");
  delete jsonData.host;
  jsonData.host = await commonHelper.getHost(req, res); // Dynamically set the host
  console.log("jsonData.host:  ", jsonData.host);
  return res.status(200).send(jsonData);
});

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQ1ZDhjNmJkLWFmMDgtNDlkMi1hZDllLWJmMDI2ZmU5MGVlYSIsImlhdCI6MTc2NDA2NDEyNH0.nJblyViyOALisJMYNgETMPu69LfFWhvI9qKHdK-91q0
module.exports = router;
//ccfadb75-ad3d-4a43-a238-7d71a81be532 //addressId

//b3351610-9a46-4995-b6cd-0dde590601d3  //productId

//461535eb-51e9-4d82-9262-ee235e5b4ede //cartId

//70975207-1c19-420c-bd3c-3a5e7473888b //storeId

//45d8c6bd-af08-49d2-ad9e-bf026fe90eea  //assignDriver