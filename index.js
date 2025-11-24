const express=require("express");
const app=express();
const fileUpload= require("express-fileupload");
const PORT=4000;
const connectdb=require('./config/connectdb')
require('./models/index')
const swaggerUi = require("swagger-ui-express");
const path=require("path")
const router=require('./router/userRouter')
 const indexRouter = require("./router/index");

 app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);
const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
      urls: [
        { url: "/api", name: "User API" },
      ],
    },
  };
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));
  app.use("/", indexRouter);
connectdb.connectdb()
app.use('/api',router)
app.get('/',(req,res) =>
{
    res.send("SERVER CREATED FOR E-COMMERCE PROJET")
})
app.listen(PORT,()=>
{
    console.log(`SERVER WILL BE RUNNING AT  http://localhost:${PORT}/`)
})
