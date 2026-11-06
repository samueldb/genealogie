#!/usr/bin/python3

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

def get_nodes():
    token = os.environ.get("CARTO_API_TOKEN")
    if not token:
        raise SystemExit("Définir CARTO_API_TOKEN avant de lancer l’import.")
    sql = "SELECT * FROM `carto-dw-ac-9baq3zs0.private_samuel_deschampsberger_58f2ff26.genealogie_db` WHERE arbre = @a1 or arbre = @a2;"
    query = urlencode({"q": sql, "queryParameters": json.dumps({"a1": 1, "a2": 2})})
    url = f"https://gcp-europe-west1.api.carto.com/v3/sql/carto_dw/query?{query}"
    request = Request(url, headers={"Authorization": f"Bearer {token}", "Cache-Control": "no-cache"})
    with urlopen(request, timeout=60) as response:
        res = json.load(response)
    nodes = res["rows"]
    print(f"getting {len(nodes)} nodes is done")
    restructured_nodes = []
    for node in nodes:
        node = {
            k: int(v) if not isinstance(v, dict) and isinstance(v, (int, float, str)) and str(v).isdigit() else v
            for k, v in node.items()
        }
        restructured_nodes.append(node)
    return restructured_nodes

def get_childrens(nodes, parent_id, genre):
    if genre == 'M':
        children = [x['own_id'] for x in nodes if x['father_id'] == parent_id]
        return children
    if genre == 'F':
        children = [x['own_id'] for x in nodes if x['mother_id'] == parent_id]
        return children

def create_rels(n, nodes):
    rels = {}
    if n['couple_id'] != 'null' and n['couple_id'] is not None:
        c = n['couple_id']
        rels['spouses'] = [c]
        print(f'    spouses : {c}')
    if n["father_id"]  != 'null' and n["father_id"] is not None and list(filter(lambda person: person['own_id'] == n['father_id'], nodes)):
        f = n['father_id']
        rels['father'] = f
        print(f'    father : {f}')
    if n["mother_id"]  != 'null' and n["mother_id"] is not None and list(filter(lambda person: person['own_id'] == n['mother_id'], nodes)):
        m = n['mother_id']
        rels['mother'] = m
        print(f'    mother : {m}')
    children_ids = get_childrens(nodes, n['own_id'], n['genre'])
    if len(children_ids) > 0:
        rels['children'] = children_ids
    return rels

def main():
    parser = argparse.ArgumentParser(description="Importer les arbres Carto dans un fichier de travail, hors du site publié.")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "docs/sources/carto/import.json",
                        help="Fichier JSON de sortie (défaut : docs/sources/carto/import.json)")
    args = parser.parse_args()
    nodes = get_nodes()
    nodes_format = []

    for n in nodes:
        print(f"{n['prenom']} - {n['nom']}")
        rels = {}
        nodes_format.append({
            'id': n['own_id'],
            'rels': create_rels(n, nodes),
            "data": {
              "first name": n['prenom'],
              "last name": n['nom'],
              "birthday": n['date_naissance'],
              "lastday": n['date_deces'],
              "job": n['profession'],
              "avatar":  n['adr_photo'] if n['adr_photo'] != None else 'https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/no_photo.png',
              "gender": n['genre'],
            }
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(nodes_format, indent=2) + "\n", encoding="utf-8")
    print(f"Import enregistré : {args.output}")


if __name__ == "__main__":
    main()
