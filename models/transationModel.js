module.exports=(Sequelize,sequelize,DataTypes) =>
{
    return sequelize.define(
        "transactionTable",
        {
            ...require('./core')(Sequelize,DataTypes),
            userId:
            {
                type:Sequelize.UUID,
                allowNull:true,
                references:
                {
                    model:"userTable",
                    key:"id"
                },
                onUpdate:"CASCADE",
                onDelete:"CASCADE"
            },
            productId:
            {
                type:Sequelize.UUID,
                allowNull:true,
                references:
                {
                    model:"productTable",
                    key:"id"
                },
                onUpdate:"CASCADE",
                onDelete:"CASCADE"
            },
            currency: {
               type: DataTypes.STRING(100),
             allowNull: true,
              defaultValue: "USD",
               },
            Amount:
            {
                type:DataTypes.STRING(225),
                allowNull:true
            },
            paymentStatus:
            {
                type:DataTypes.INTEGER,
                allowNull:true,
                defaultValue:0  //0 for pending 1 for success
            },
            paymentMethod:
            {
                type:DataTypes.INTEGER,
                allowNull:true,
                defaultValue:0   //0 FOR COD AND 1 FOR ONLINE
            }
        },
        {
            tableName:"transactionTable"
        }
    )
}