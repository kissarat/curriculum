module.exports = {
    columns: function (db, entities) {
        db.query('select * from columns', function(err, result) {
            if (err)
                return console.error(err);
            if (!entities)
                entities = {};
            result.rows.forEach(function(row) {
                if (!entities[row.table])
                     entities[row.table] = {};
                entities[row.table][row.name] = row;
            });
        })
    }
};