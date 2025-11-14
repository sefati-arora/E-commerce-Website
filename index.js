const express=require("express")
const app = express()
const PORT=4000;
const fileUpload= require("express-fileupload");
const path=require("path")
require('./config/connectdb').connectdb()
require('./models/index')
const router=require('./router/userRouter')
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
app.use("/api",router)
app.get("/",(req,res) =>
{
    res.send("SERVER CREATED>>>> ")
})
app.listen(PORT,()=>
{
    console.log(`SERVER WILL BE RUNNING AT  http://localhost:${PORT}/`)
})