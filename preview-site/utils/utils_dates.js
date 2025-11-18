export default {
    formatDate
}

function formatDate(date) {
    var dateFormatee = "";
    if (date == null || date == "null" || date == "") return "null";
    else {
        dateFormatee = date.substring(8, 10) + " " + getMonth(date.substring(5, 7)) + " " + date.substring(0, 4);
        return dateFormatee;
    }
}

function getMonth(mm) {
    switch (mm) {
        case "01": return "Janvier";
        case "02": return "Fevrier";
        case "03": return "Mars";
        case "04": return "Avril";
        case "05": return "Mai";
        case "06": return "Juin";
        case "07": return "Juillet";
        case "08": return "Aout";
        case "09": return "Septembre";
        case "10": return "Octobre";
        case "11": return "Novembre";
        case "12": return "Decembre";
    }
}