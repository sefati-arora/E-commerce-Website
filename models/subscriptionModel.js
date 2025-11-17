module.exports=(Sequelize,sequelize,DataTypes) =>
{
    return sequelize.define(
        "subscriptionTable",
        {
            ...require('./core')(Sequelize,DataTypes),
            title:
            {type:DataTypes.STRING(225),
            allowNull:true
        },
        subscriptionType:
        {
            type:DataTypes.INTEGER,
            allowNull:true,
            defaultValue:0   //0 for monthly  1 for yearly
        },
        Amount:
        {
            type:DataTypes.DOUBLE,
            allowNull:true
        },
        description:
        {
            type:DataTypes.TEXT("long"),
            allowNull:true
        }
        },
        {
            tableName:"subscriptionTable"
        }
    )
}