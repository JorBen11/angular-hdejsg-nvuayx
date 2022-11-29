import {SelectionModel} from '@angular/cdk/collections';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {FlatTreeControl} from '@angular/cdk/tree';
import {Component, Injectable} from '@angular/core';
import { findNativeEncapsulationNodes } from '@angular/core/schematics/migrations/native-view-encapsulation/util';
import { MatCheckboxChange } from '@angular/material/checkbox';
import {MatTreeFlatDataSource, MatTreeFlattener} from '@angular/material/tree';
import {BehaviorSubject} from 'rxjs';
import {FilterService } from './filter.service';

/**
 * Node for to-do item
 */
export class TodoItemNode {
  id: string;
  children?: TodoItemNode[];
  item: string;
}

/** Flat to-do item node with expandable and level information */
export class TodoItemFlatNode {
  id: string;
  item: string;
  level: number;
  expandable: boolean;
  hasChild:boolean; // new property
}

/**
 * The Json object for to-do list data.
 */
 const TREE_DATA = JSON.stringify({
  'Por Distribucion Comercial': [
    'Mayorista',
    'Minorista (Retail)',
    'Fabricante',
    'Distribuidor',
    'Importador',
    'Exportador',

  ],
  'Por Consignacion': [
    'Si',
    'No'
  ],
  'Por Localizacion':[
    'Local',
    'Nacional',
    'Internacional',
    'Global'
  ],
  'Por Sector Economico': {
    'Primario': [
      'Agricola'
    ],
    'Secundario':[],'Terciario':[]
  }
});

/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
@Injectable()
export class ChecklistDatabase {
  dataChange = new BehaviorSubject<TodoItemNode[]>([]);

  get data(): TodoItemNode[] { return this.dataChange.value; }

  constructor() {
    this.initialize();
  }

  initialize() {

    const dataObject = JSON.parse(TREE_DATA);
    // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
    //     file node as children.
    const data = this.buildFileTree(dataObject, 0);

    // Notify the change.
    this.dataChange.next(data);
  }

  /**
   * Build the file structure tree. The `value` is the Json object, or a sub-tree of a Json object.
   * The return value is the list of `TodoItemNode`.
   */
  buildFileTree(obj: {[key: string]: any}, level: number, parentId: string = '0'): TodoItemNode[] {
    return Object.keys(obj).reduce<TodoItemNode[]>((accumulator, key, idx) => {
      const value = obj[key];
      const node = new TodoItemNode();
      node.item = key;
      node.id = `${parentId}/${idx}`

      if (value != null) {
        if (typeof value === 'object') {
          node.children = this.buildFileTree(value, level + 1, node.id);
        } else {
          node.item = value;
        }
      }

      return accumulator.concat(node);
    }, []);
  }

  /** Add an item to to-do list */
/*insertItem(parent: TodoItemNode, name: string) {
    if (!parent.children) parent.children=[];
    parent.children.push({ item: name } as TodoItemNode);
    this.dataChange.next(this.data);
}*/

insertItem(parent: TodoItemNode, name: string) {
  if (!parent.children) parent.children = [];
  parent.children.push({ item: name } as TodoItemNode);
  this.dataChange.next(this.data);
}

deleteItem(parent: TodoItemNode, name: string): void {
  if (parent.children) {
    parent.children = parent.children.filter(c => c.item !== name);
    this.dataChange.next(this.data);
  }
}

  updateItem(node: TodoItemNode, name: string) {
    node.item = name;
    this.dataChange.next(this.data);
  }

  deleteItemParent(parent: TodoItemNode, name: string): void {
    if (parent.children) {
      parent.children.pop();
      this.dataChange.next(this.data);
    }
}

}


/**
 * @title Tree with checkboxes
 */
@Component({
  selector: 'tree-checklist-example',
  templateUrl: 'tree-checklist-example.html',
  styleUrls: ['tree-checklist-example.css'],
  providers: [ChecklistDatabase, FilterService]
})
export class TreeChecklistExample {
  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap = new Map<TodoItemFlatNode, TodoItemNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap = new Map<TodoItemNode, TodoItemFlatNode>();

  /** A selected parent node to be inserted */
  selectedParent: TodoItemFlatNode | null = null;

  /** The new item's name */
  newItemName = '';

  treeControl: FlatTreeControl<TodoItemFlatNode>;

  treeFlattener: MatTreeFlattener<TodoItemNode, TodoItemFlatNode>;

  dataSource: MatTreeFlatDataSource<TodoItemNode, TodoItemFlatNode>;

  expansionModel = new SelectionModel <string>(true);
  dragging = false;
  expandTimeout: any;
  expandDelay = 1000;
  validateDrop = true;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<TodoItemFlatNode>(true /* multiple */);

  constructor(private _database: ChecklistDatabase) {
    this.treeFlattener = new MatTreeFlattener(this.transformer, this.getLevel,
      this.isExpandable, this.getChildren);
    this.treeControl = new FlatTreeControl<TodoItemFlatNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

    _database.dataChange.subscribe(data => this.rebuildTreeForData(data));
  }

  getLevel = (node: TodoItemFlatNode) => node.level;

  isExpandable = (node: TodoItemFlatNode) => node.expandable;

  getChildren = (node: TodoItemNode): TodoItemNode[] => node.children;

  hasChild = (_: number, _nodeData: TodoItemFlatNode) => _nodeData.expandable;

  hasNoContent = (_: number, _nodeData: TodoItemFlatNode) => _nodeData.item === '';

  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  transformer = (node: TodoItemNode, level: number) => {
    const existingNode = this.nestedNodeMap.get(node);
    const flatNode = existingNode && existingNode.item === node.item
        ? existingNode
        : new TodoItemFlatNode();
    flatNode.item = node.item;
    flatNode.level = level;
    flatNode.id = node.id;
    flatNode.expandable = true;                   // edit this to true to make it always expandable
    flatNode.hasChild = !!node.children?.length;  // add this line. this property will help 
                                                  // us to hide the expand button in a node
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  }

  shouldValidate(event: MatCheckboxChange): void {
    this.validateDrop = event.checked;
  }

  visibleNodes(): TodoItemNode[] {
    const result = [];

    function addExpandedChildren(node: TodoItemNode, expanded: string[]){
      result.push(node);
      if (expanded.includes(node.id)) {
        node.children.map((child) => addExpandedChildren(child, expanded));

      }

    }
    this.dataSource.data.forEach((node) => {
      addExpandedChildren(node, this.expansionModel.selected);
    });
    return result;
  }

  drop(event: CdkDragDrop<string[]>) {
    
    // ignora soltarlo fuera del arbol
    if(!event.isPointerOverContainer) return;

    /**Construye una lista de nodos visibles, emparejaran con el DOM.
     * el ckDrop event.currentIndex da con los nodos visibles
     * llama rememberExpandedTreeNodes para seguir con el estado expandido
     */
    const visibleNodes = this.visibleNodes();

    /**clona la fuente de datos, asi podemos modificarla */
    const changedData = this.dataSource.data;

    /**funcion de busqueda recursiva para encontrar hermanos del nodo */
    function findNodeSiblings(arr: Array<any>, id: string): Array<any> {
      let result, subResult;
      arr.forEach((item, i) => {
        if (item.id === id) {
          result = arr;
        } else if (item.children) {
          subResult = findNodeSiblings (item.children, id);
          if (subResult) result = subResult;
        }
      });
      return result;
    }
    //Determina donde insertar el nodo
    const nodeAtDest = visibleNodes[event.currentIndex];
    const newSiblings = findNodeSiblings (changedData, nodeAtDest.id);
    if (!newSiblings) return;
    const insertIndex = newSiblings.findIndex(s => s.id === nodeAtDest.id);

    //Quita el nodo de su antiguo sitio
    const node = event.item.data;
    const siblings = findNodeSiblings(changedData, node.id);
    const siblingIndex = siblings.findIndex(n => n.id === node.id);
    const nodeToInsert: TodoItemNode = siblings.splice(siblingIndex, 1)[0];
    if (nodeAtDest.id === nodeToInsert.id) return;

    //Valida si el drop es en el mismo nivel
    const nodeAtDestFlatNode = this.treeControl.dataNodes.find((n) => nodeAtDest.id === n.id);
    if (this.validateDrop && nodeAtDestFlatNode.level !== node.level) {
      alert('Los items solo se pueden mover en su mismo nivel.');
      return;
    }

    //Inserte nodo
    newSiblings.splice(insertIndex, 0, nodeToInsert);

    //Reconstruye el arbol con los datos cambiados
    this.rebuildTreeForData(changedData);
  }

  /**Experimental - abre el arbol segun te muevas en sus nodos */
  dragStart(){
    this.dragging = true;
  }
  dragEnd(){
    this.dragging = false;
  }

  dragHover(node: TodoItemFlatNode){
    if (this.dragging) {
      clearTimeout(this.expandTimeout);
      this.expandTimeout = setTimeout(() => {
        this.treeControl.expand(node);
      }, this.expandDelay);
    }
  }

  dragHoverEnd() {
    if (this.dragging) {
      clearTimeout(this.expandTimeout);
    }
  }

  /**
   * El siguiente metodo son para dejar el arbol expandido luego de su reconstruccion
   */
  rebuildTreeForData(data: any){
    this.dataSource.data = data;
    this.expansionModel.selected.forEach((id) => {
      const node = this.treeControl.dataNodes.find((n) => n.id === id);
      this.treeControl.expand(node);
    });
  }

  /** Whether all the descendants of the node are selected. */
  descendantsAllSelected(node: TodoItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected = descendants.length > 0 && descendants.every(child => {
      return this.checklistSelection.isSelected(child);
    });
    return descAllSelected;
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: TodoItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child => this.checklistSelection.isSelected(child));
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle the to-do item selection. Select/deselect all the descendants node */
  todoItemSelectionToggle(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);

    // Force update for the parent
    descendants.forEach(child => this.checklistSelection.isSelected(child));
    this.checkAllParentsSelection(node);
  }

  /** Toggle a leaf to-do item selection. Check all the parents to see if they changed */
  todoLeafItemSelectionToggle(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    this.checkAllParentsSelection(node);
  }

  /* Checks all the parents when a leaf node is selected/unselected */
  checkAllParentsSelection(node: TodoItemFlatNode): void {
    let parent: TodoItemFlatNode | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }

  /** Check root node checked state and change it accordingly */
  checkRootNodeSelection(node: TodoItemFlatNode): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected = descendants.length > 0 && descendants.every(child => {
      return this.checklistSelection.isSelected(child);
    });
    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }

  /* Obetener el nodo padre de los nodos*/
  getParentNode(node: TodoItemFlatNode): TodoItemFlatNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  /** Select the category so we can insert the new item. */
  addNewItem(node: TodoItemFlatNode) {
    const parentNode = this.flatNodeMap.get(node);
    this._database.insertItem(parentNode!, '');
    this.treeControl.expand(node);
  }

  /** Save the node to database */
  saveNode(node: TodoItemFlatNode, itemValue: string) {
    const nestedNode = this.flatNodeMap.get(node);
    this._database.updateItem(nestedNode!, itemValue);
  }

  
  private expandedNodesById(flatNodes: TodoItemFlatNode[], ids: string[]) {
    if (!flatNodes || flatNodes.length === 0) return;
    const idSet = new Set(ids);
    return flatNodes.forEach((node) => {
      if (idSet.has(node.id)) {
        this.treeControl.expand(node);
        let parent = this.getParentNode(node);
        while (parent) {
          this.treeControl.expand(parent);
          parent = this.getParentNode(parent);
        }
      }
    });
  }

  deleteItem(node: TodoItemFlatNode): void {
    const parentNode = this.getParentNode(node);
    const parentFlat = this.flatNodeMap.get(parentNode);
    this._database.deleteItem(parentFlat!, node.item);
    this.treeControl.expand(node)
  }

  deleteItemParent(node: TodoItemFlatNode): void {
    const parentNode = this.flatNodeMap.get(node);
    this._database.deleteItemParent(parentNode, '');
    this.treeControl.expand(node);
  }

  /*filterChanged(filterText: string) {
    t.filter(filterText);
    if(filterText) {
      this.treeControl.expandAll();
    } else {
      this.treeControl.collapseAll();
    }
  }*/

  filterRecursive(filterText: string, array: any[], property: string) {
    let filterData;

    function copy(o: any) {
      return Object.assign({}, o);
    }

    if (filterText) {
      filterText = filterText.toLowerCase();
      filterData = array.map(copy).filter(function x(y) {
        if(y[property].toLowerCase().includes(filterText)) {
          return true;
        }
        if(y.children){
          return (y.children = y.children.map(copy).filter(x)).length;
        }
      });
    }else{
      filterData=array;
    }
    return filterData;
  }

  filterTree(filterText: string) {
    this.dataSource.data = this.filterRecursive(filterText, this._database.data, 'item');
  }

  applyFilter(filterText: string){
    this.filterTree(filterText);

    if(filterText) {
      this.treeControl.expandAll();
    }else{
      this.treeControl.collapseAll();
    }
  }

}




/**  Copyright 2020 Google LLC. All Rights Reserved.
    Use of this source code is governed by an MIT-style license that
    can be found in the LICENSE file at http://angular.io/license */