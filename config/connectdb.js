const Sequelize =require("sequelize")
const sequelize=new Sequelize("e-commercewebsite","root","password",
    {
        host:"localhost",
        dialect:"mysql"
    }
);
    const connectdb=async() =>
    {
        await sequelize.authenticate().then(
            async () =>
            {
                await sequelize.sync({alter:false})
                console.log("db connected")
            }
        )
        .catch((error) =>
        {
            console.log("Unable to connect")
        })
    };
module.exports=
{
    connectdb:connectdb,
    sequelize:sequelize
}
