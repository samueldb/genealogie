import React from 'react';
import * as d3 from 'd3';
import '../styles/App.css';
import Banner from "./Banner";
import Menu from "./Menu";
import TreeDiagram from "./TreeDiagram";

class App extends React.Component {
  constructor(props){
    super(props);
    this.myRef = React.createRef();
  }
  componentDidMount(){
    console.log(this.myRef);
    d3.select(this.myRef.current)
        .append('p')
        .text('Coucou depuis d3');
    var svg = d3.select('#my-svg');

  }
  render(){
    return (
        <div>
          <Banner />
          <Menu />
          <TreeDiagram />
      </div>
    );
  }

}
export default App;
