import styled from "styled-components";
import React from "react";
const StyledMenu = styled.nav`
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #eff3ff;
  transform: ${({open}) => open ? 'translateX(0)' : 'translateX(-100%)'};
  height: 100%;
  text-align: left;
  padding: 2rem;
  position: absolute;
  top: 0;
  left: 0;
  transition: transform 0.3s ease-in-out;
  font-family: 'Architects Daughter', 'Helvetica Neue', Helvetica, Arial, serif;
  width:20%;

  @media (max-width: 576px) {
    width: 100%;
  }

  a {
    font-size: 1.5rem;
    text-transform: uppercase;
    padding: 2rem 0;
    font-weight: bold;
    letter-spacing: 0.5rem;
    color: #0D0C1D;
    text-decoration: none;
    transition: color 0.3s linear;

    @media (max-width: 576px) {
      font-size: 1.5rem;
      text-align: center;
    }

    &:hover {
      color: #343078;
    }
  }
`

const InterneMenu = ({ open }) => {
    return (
        <StyledMenu open={open}>
            <a href="/">
                <span role="img">🌳️</span>
                Arbre
                Généalogique
            </a>
            <a href="/">
                <span role="img">📅</span>
                Timeline DB
            </a>
            <a href="/">
                <span role="img">🗺</span>
                Cartographie
            </a>
            <a href="/">
                <span role="img">📩</span>
                Contact
            </a>
        </StyledMenu>
    )
}

const StyledBurger = styled.button`
  position: absolute;
  top: 5%;
  left: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 10;

  &:focus {
    outline: none;
  }

  div {
    width: 2rem;
    height: 0.25rem;
    background: ${({ open }) => open ? '#0D0C1D' : '#EFFFFA'};
    border-radius: 10px;
    transition: all 0.3s linear;
    position: relative;
    transform-origin: 1px;

    :first-child {
      transform: ${({ open }) => open ? 'rotate(45deg)' : 'rotate(0)'};
    }

    :nth-child(2) {
      opacity: ${({ open }) => open ? '0' : '1'};
      transform: ${({ open }) => open ? 'translateX(20px)' : 'translateX(0)'};
    }

    :nth-child(3) {
      transform: ${({ open }) => open ? 'rotate(-45deg)' : 'rotate(0)'};
    }
  }
`

const Burger = ({ open, setOpen }) => {
    return (
        <StyledBurger open={open} onClick={() => setOpen(!open)}>
            <div />
            <div />
            <div />
        </StyledBurger>
    )
}

const Menu = () => {
    const [open, setOpen] = React.useState(false);
    const node = React.useRef();
    return (
        <div>
            <div ref={node}>
                <Burger open={open} setOpen={setOpen} />
                <InterneMenu open={open} setOpen={setOpen} />
            </div>
        </div>
    )
}

const useOnClickOutside = (ref, handler) => {
    React.useEffect(() => {
            const listener = event => {
                if (!ref.current || ref.current.contains(event.target)) {
                    return;
                }
                handler(event);
            };
            document.addEventListener('mousedown', listener);

            return () => {
                document.removeEventListener('mousedown', listener);
            };
        },
        [ref, handler],
    );
};

export default Menu;