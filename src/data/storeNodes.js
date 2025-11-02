import {executeSQL} from "@carto/react-api";

const credentials = {
    apiVersion: 'v2',
    username: 'samueldeschampsberger',
    apiKey: 'default_public',
    serverUrlTemplate: 'https://samueldeschampsberger.carto.com'
}

const getAllDBNodes = async () => {
    const query = "SELECT own_id, nom, prenom FROM nodes WHERE arbre='1'";

    const result = await executeSQL({ credentials, query});
    return result;
};

export async function getDBNodes(){
    return await getAllDBNodes();
}

export const getAllFamilyNames = async ({ id, credentials, opts }) => {
    const query = `
    SELECT distinct(nom)
      FROM nodes
      WHERE arbre='${id}'
  `;

    return executeSQL({ credentials, query, opts }).then((data) => data[0]);
};