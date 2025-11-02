import {getDBNodes} from '../data/storeNodes'

class PersonsList extends React.Component{
    constructor(props) {
        super(props);
        this.state = {

        };
    }
}
function PersonLists() {
    getDBNodes().then((rows)=>
        {console.log(rows);
        return (
            <div>IS THIS WORKING ?
                <ul>
                    {rows.map((node) =>
                        (<li key={node.own_id}>{node}</li>))
                    }
                </ul>
            </div>
        )}
    );
}

export default PersonLists;