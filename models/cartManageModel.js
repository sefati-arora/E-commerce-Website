module.exports=(Sequelize,sequelize,DataTypes) =>
{
    return sequelize.define(
        "cartManageTable",
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
            }
        },
        {
            tableName:"cartManageTable"
        }
    )
}