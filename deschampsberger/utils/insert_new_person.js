const fs = require("fs");

function checkValiditeInsert(insert, type) {
    var res = insert;
    if (type == 'string') {
        if (insert.indexOf("'") > 0) {
            res = insert.replace("'", "''");
        }
        if (insert.indexOf("&") > 0) {
            res = insert.replace("&", "%26");
        }
    }
    if (type == 'id') {
        if (insert === " ") {
            res = "null";
        }
    }
    if (type == 'date') {
        if (insert === " ") {
            res = "null";
        }
    }
    return res;
}

function geocoder(adr, cp, ville) {
    var res = "";
    getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=' + adr + ' ' + cp + ' ' + ville).done(function (data) {
        // s'il n'y a pas de data,
        if (data.length > 0) {
            if (data[0].lon != undefined && data[0].lat != undefined) {
                res = 'ST_SetSRID(ST_Point(' + data[0].lon + ', ' + data[0].lat + '),4326)';
            }
            else if (data.responseJSON[0].lat != undefined && data.responseJSON[0].lon != undefined) {
                res = 'ST_SetSRID(ST_Point(' + data.responseJSON[0].lon + ', ' + data.responseJSON[0].lat + '),4326)';
            }
        }
    });
    if (res == "") {
        // On essaie sans le numéro de l'adresse
        adr2 = adr;
        while (adr2.match(/\d/) != null) {
            adr2 = adr2.replace(/(\d)/, "");
        }
        getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=' + adr2 + ' ' + cp + ' ' + ville).done(function (dataAdr) {
            if (dataAdr.length > 0) {
                if (dataAdr[0].lon != undefined && dataAdr[0].lat != undefined) {
                    res = 'ST_SetSRID(ST_Point(' + dataAdr[0].lon + ', ' + dataAdr[0].lat + '),4326)';
                }
                else if (dataAdr.responseJSON[0].lat != undefined && dataAdr.responseJSON[0].lon != undefined) {
                    res = 'ST_SetSRID(ST_Point(' + dataAdr.responseJSON[0].lon + ', ' + dataAdr.responseJSON[0].lat + '),4326)';
                }
            }
        });
    }
    if (res == "") {
        getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=' + ville).done(function (dataVille) {
            if (dataVille.length > 0) {
                alert('l\'adresse n\'a pu être géocodée, seule la ville sera ajoutée');
                res = 'ST_SetSRID(ST_Point(' + dataVille[0].lon + ', ' + dataVille[0].lat + '),4326)';
            }
        });
    }
    return res;
}

function add_Personne(new_id, tree){
    var nom = checkValiditeInsert($(id_txt_new_nom).val(), 'string');
    var prenom = checkValiditeInsert($(id_txt_new_prenom).val(), 'string');
    var genre = checkValiditeInsert($(genres).val(), 'string');
    var adr = $(id_txt_new_adr).val();
    var cp = checkValiditeInsert($(id_txt_new_cp).val(), 'cp');
    var ville = $(id_txt_new_ville).val();
    var pays = checkValiditeInsert($(id_txt_new_pays).val(), 'string');
    var pere = checkValiditeInsert($(id_pere).val(), 'id');
    var mere = checkValiditeInsert($(id_mere).val(), 'id');
    var job = checkValiditeInsert($(id_txt_new_job).val(), 'string');
    var date_birth = checkValiditeInsert($(datepicker_new_dn).val(), 'date');
    var date_death = checkValiditeInsert($(datepicker_new_dd).val(), 'date');
    var date_mariage = checkValiditeInsert($(datepicker_new_dm).val(), 'date');
    var com = checkValiditeInsert($(id_txt_new_com).val(), 'string');

    person_rels = {}
    if (pere.length> 0){
        person_rels.father = pere;
    }
    if (mere.length > 0){
        person_rels.mother = mere;
    }
    person = {
        "id" : new_id,
        "rels" : person_rels,
        "data" : {
            "first name" : prenom,
            "last name" : nom,
            "birthday" : date_birth,
            "lastday" : date_death,
            "lastday" : date_death,
            "job" : job,
            "avatar" : "https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/no_photo.png",
            "gender" : genre
        }
    }
    let usersjson = JSON.parse(fs.readFileSync("../index/data_db.json","utf-8"));
    usersjson.push(person);
    tree.add(person);
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));

}
