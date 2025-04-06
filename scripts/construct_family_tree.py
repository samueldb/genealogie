#!/usr/bin/python3

import json

import requests

def get_nodes():
    # sql=f"-- SELECT * FROM `carto-dw-ac-9baq3zs0.private_samuel_deschampsberger_58f2ff26.genealogie_db` WHERE own_id = @a1 or own_id = @a2;"
    sql=f"SELECT * FROM `carto-dw-ac-9baq3zs0.private_samuel_deschampsberger_58f2ff26.genealogie_db` WHERE arbre = @a1 or arbre = @a2;"
    # sql=f"-- SELECT * FROM `carto-dw-ac-9baq3zs0.private_samuel_deschampsberger_58f2ff26.genealogie_db` WHERE True;"
    # sql=f"-- SELECT geom, name FROM carto-demo-data.demo_tables.populated_places"
    print(f"sql : {sql}...")
    url = (f'https://gcp-europe-west1.api.carto.com/v3/sql/carto_dw/query?'
           # f'q={sql})')
           f'q={sql}&'
           # 'queryParameters={"a1":171,"a2":206}')
           'queryParameters={"a1":1,"a2":2}')
    headers = {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfOWJhcTN6czAiLCJqdGkiOiI0YmEyNzA5MiJ9.PW4AyuxCYNu_7AXDXA1ggYx70H8vE52GGmuntxf-Mf4',
        'queryParameters':'[1,2]',
        'Cache-Control': 'no-cache'
    }
    res = []
    try :
        res = requests.get(
            url,
            headers=headers
        ).json()
    except Exception as e:
        print(e, url)
        pass
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

nodes = get_nodes()
nodes_format = []

for n in nodes:
    print(f"{n['prenom']} - {n['nom']}")
#     children_ids = get_childrens(nodes, n['own_id'], n['genre'])
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
with open('../data_db.json', 'w') as f:
    json.dump(nodes_format, f, indent=2)
