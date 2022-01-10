import React from 'react';
import * as d3 from 'd3';
import '../styles/App.css';
import Banner from "./Banner";
import Menu from "./Menu";

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
  }
  render(){
    return (
        <div>
          <Banner />
          <Menu />
      </div>
    );
  }

}
export default App;
