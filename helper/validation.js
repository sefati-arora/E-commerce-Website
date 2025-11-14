module.exports={
    validationJoi: async(data,schema) =>
    {
        const validschema = await schema.validate(data);
        if(validschema && validschema.error)
        {
            throw validschema.error;
        }
        else
        {
            return validschema.value;
        }
    }
}