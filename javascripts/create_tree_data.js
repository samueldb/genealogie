function populateNodes(){
    var NoeudsBase = [];
    var availableNames = [];
    NoeudsBase = findAllNodes();
    return NoeudsBase[0];
}


function findAllNodes(){
    var noeuds = [];
    var aNames = [];
    var sql_statement = "SELECT * FROM nodes WHERE arbre = '1' or arbre = '2'";
    $.ajaxSetup({
        async: false
    });
    $.ajax({
        url: 'https://samueldeschampsberger.cartodb.com/api/v2/sql/?q=' + sql_statement,
        dataType: 'json',
        async: false,
        success: function (data_json) {
            if (data_json.rows.length == 0) {
                // Il n'y a personne dans la table
                alert("Il n'y a pas encore de personne dans cet arbre !");
            }
            else if (data_json.rows.length > 0) {
                // Pour chaque ligne, on vérifie
                for (var r of data_json.rows) {
                    var newPerson = {
                        "id": r.own_id,
                        "name": formatNames(r.nom, r.prenom),
                        "gender": r.genre == "F" ? "female" : "male",
                        "born": formatDate(r.date_naissance),
                        "img": r.adr_photo == null ? "images/no_photo.png" : "images/portraits/" + r.own_id + ".jpg",
                        "job": r.profession,
                        "date_die": formatDate(r.date_deces),
                        "date_mariage": formatDate(r.date_mariage),
                    }
                    if(r.couple_id !== 172){
                        newPerson.pids = [r.couple_id];
                    }
                    if (r.father_id !== null) {
                        if (r.father_id !== 172) {
                            newPerson.fid = r.father_id;
                        }
                    }
                    if (r.mother_id !== null) {
                        newPerson.mid = r.mother_id;
                    }

                    noeuds.push(newPerson);
                    if (aNames.find(function (a) { return a == r.nom; })) { }
                    else { aNames.push(r.nom); }
                }
            }
        }
    });
    console.log("got all nodes i need")
    return [noeuds, aNames];
}
