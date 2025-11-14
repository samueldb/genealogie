import {toggleAllRels, toggleRels} from "../CalculateTree/CalculateTree.handlers.js"
import {deletePerson, moveToAddToAdded} from "../CreateTree/form.js"

export function cardChangeMain(store, {d}) {
  // Add error handling and ensure store is initialized
  if (!store || !store.getTree) {
    console.error('Store or getTree method not available');
    return false;
  }

  toggleAllRels(store.getTree().data, false);
  store.updateMainId(d.data.id);
  store.updateTree({tree_position: store.state.tree_fit_on_change});
  return true;
}

export function cardEdit(store, {d, cardEditForm}) {
  const datum = d.data,
    postSubmit = (props) => {
      if (datum.to_add) moveToAddToAdded(datum, store.getData())
      if (props && props.delete) {
        if (datum.main) store.updateMainId(null)
        deletePerson(datum, store.getData())
      }
      store.updateTree()
    }
  cardEditForm({datum, postSubmit, store})
}

export function cardShowHideRels(store, {d}) {
  d.data.hide_rels = !d.data.hide_rels
  toggleRels(d, d.data.hide_rels)
  store.updateTree({tree_position: store.state.tree_fit_on_change});
  return true;
}