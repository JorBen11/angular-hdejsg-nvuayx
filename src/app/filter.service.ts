import { Injectable } from '@angular/core';
//import { TreeChecklistExample } from './tree-checklist-example.ts';
import {BehaviorSubject} from 'rxjs';
import { TodoItemNode } from './tree-checklist-example';

const TREE_DATA = JSON.stringify({
  Groceries: {
    'Almond Meal flour': null,
    'Organic eggs': null,
    'Protein Powder': null,
    Fruits: {
      Apple: null,
      Berries: ['Blueberry', 'Raspberry'],
      Orange: null
    }
  },
  Reminders: [
    'Cook dinner',
    'Read the Material Design spec',
    'Upgrade Application to Angular'
  ]
});

@Injectable()
export class FilterService {
  dataChange = new BehaviorSubject<TodoItemNode[]>([]);
  //treeData: any[];
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

  buildFileTree(obj: any[], level: number): TodoItemNode[] {
    return obj.filter(o =>
      (<string>o.id).startsWith(level.toString() + '.')
      && (o.id.match(/\./g) || []).length === (level.toString().match(/\./g) || []).length + 1
    )
      .map(o => {
        const node = new TodoItemNode();
        node.item = o.text;
        node.id = o.id;
        const children = obj.filter(so => (<string>so.id).startsWith(level.toString() + '.'));
        if (children && children.length > 0) {
          node.children = this.buildFileTree(children, o.id);
        }
        return node;
      });
  }

  public filter(filterText: string) {
    let filteredTreeData;
    if (filterText) {
      console.log(this.data);
      filteredTreeData = this.data.filter(d => d.item.toLocaleLowerCase().indexOf(filterText.toLocaleLowerCase()) > -1);
      Object.assign([], filteredTreeData).forEach(ftd => {
        let str = (<string>ftd.id);
        while (str.lastIndexOf('.') > -1) {
          const index = str.lastIndexOf('.');
          str = str.substring(0, index);
          if (filteredTreeData.findIndex(t => t.id === str) === -1) {
            const obj = this.data.find(d => d.id === str);
            if (obj) {
              filteredTreeData.push(obj);
            }
          }
        }
      });
    } else {
      filteredTreeData = this.data;
    }

    // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
    // file node as children.
    const data = this.buildFileTree(filteredTreeData, 0);
    // Notify the change.
    this.dataChange.next(data);
  }
}