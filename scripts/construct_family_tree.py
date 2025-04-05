import json

import requests

def get_nodes():
    sql=f"SELECT * FROM `carto-dw-ac-9baq3zs0.private_samuel_deschampsberger_58f2ff26.genealogie_db` WHERE arbre = @a1 or arbre = @a2;"
    # sql=f"-- SELECT geom, name FROM carto-demo-data.demo_tables.populated_places"
    print(f"sql : {sql}...")
    url = (f'https://gcp-europe-west1.api.carto.com/v3/sql/carto_dw/query?'
           f'q={sql}&'
           'queryParameters={"a1":1,"a2":2}')
    headers = {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfOWJhcTN6czAiLCJqdGkiOiI0YmEyNzA5MiJ9.PW4AyuxCYNu_7AXDXA1ggYx70H8vE52GGmuntxf-Mf4',
        'queryParameters':'[1,2]'
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
    print(f"nodes done")
    return nodes

def get_childrens(nodes, parent_id, genre):
    if genre == 'M':
        children = [x for x in nodes if x['father_id'] == parent_id]
        return children
    if genre == 'F':
        children = [x for x in nodes if x['mother_id'] == parent_id]
        return children
nodes = get_nodes()
nodes_format = []
for n in nodes:
    print(f"{n['prenom']} - {n['nom']}")
    children_ids = get_childrens(nodes, n['own_id'], n['genre'])
    rels = {}
    nodes_format.append({
        'id': n['own_id'],
        'rels': {
            'spouses': [n['couple_id']],
            'father': n["father_id"],
            'mother': n["mother_id"],
            'children': children_ids # need to be recomputed
        },
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
with open('results.json', 'w') as f:
    json.dump(nodes_format, f)
