module.exports=(Sequelize,sequelize,DataTypes) =>
{
    return sequelize.define(
        "cartTable",
        {
            ...require('./core')(Sequelize,DataTypes),
            productId:
            {
                type:Sequelize.UUID,
                allowNull:false,
                references:
                {
                    model:"productTable",
                    key:"id"
                },
                onUpdate:"CASCADE",
                onDelte:"CASCADE"
            },
            Quantity:
            {
                type:DataTypes.INTEGER,
                allowNull:true,
                defaultValue: 1,
            },
            cartId: {
             type: Sequelize.UUID,
             allowNull: true,
            references: {
              model: "cartManageTable",
              key: "id",
              },
            onUpdate: "CASCADE",
             onDelete: "CASCADE",
           },
        },
        {
            tableName:"cartTable"
        }
    )
}