function formatNames(name, prenom) {
    var resName = "";
    if (name.includes(" ") ||name.includes("-")){
        var index = name.indexOf(" ");
        if (index == -1){
            index = name.indexOf("-");
        }
        resName = prenom + " " + name[0]+ "." + name[index+1]+ "." ;
    }
    else {
        resName = prenom + " " + name[0]+ "." ;
    }
    return resName;
}

function formatDate(date) {
    var dateFormatee = "";
    if (date == null || date == "null" || date == "") return "null";
    else {
        dateFormatee = date.substring(8, 10) + "-" + date.substring(5, 7) + "-" + date.substring(0, 4);
        return dateFormatee;
    }
}