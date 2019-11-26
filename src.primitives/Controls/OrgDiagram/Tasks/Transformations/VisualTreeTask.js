﻿/* method uses structures created in orgTreeTask to create visual tree used to render chart
	It populates visualTree structure with TreeItem objects.
	
	1. Create invisble visual root item, so all orphants added to it, but since it is invisible, no connections are going to be drawn betwen them
	2. Loop orgTree nodes and populate visual tree hierarchy: visualTree
*/
primitives.orgdiagram.VisualTreeTask = function (orgTreeTask, activeItemsTask, visualTreeOptionTask, isFamilyChartMode) {
  var _data = {
    visualTree: null, /* primitives.common.tree(); key: primitives.orgdiagram.TreeItem.id value:primitives.orgdiagram.TreeItem */
    leftMargins: {},
    rightMargins: {},
    navigationFamily: null /* family structure where key: TreeItem.id and value: TreeItem */
  },
    _treeItemCounter,
    _activeItems;

  function process() {
    var orgTree = orgTreeTask.getOrgTree(),
      options = visualTreeOptionTask.getOptions();

    _activeItems = activeItemsTask != null ? activeItemsTask.getActiveItems() : {};

    _data.visualTree = primitives.common.tree();
    _data.navigationFamily = primitives.common.family();

    _treeItemCounter = orgTreeTask.getMaximumId();

    if (orgTree.hasNodes()) {
      createVisualTreeItems(orgTree, options, _data.visualTree);
    }


    _data.leftMargins = {},
      _data.rightMargins = {};
    updateVisualTreeMargins(_data.visualTree, _data.leftMargins, _data.rightMargins);

    return true;
  }

  function createVisualTreeItems(orgTree, options, visualTree) {
    var treeItem,
      visualParent,
      visualAggregator,
      leftSiblingIndex,
      rightSiblingIndex,
      index, len,
      childIndex,
      childrenLen,
      depth,
      rowDepths,
      rowDepth,
      rowAggregators = {},
      rowAggregator,
      rowChildren = {},
      children,
      leftSiblingOffset,
      rightSiblingOffset,
      partners = {}, tempPartners;


    /* org tree item has visible children */
    orgTree.loopPostOrder(this, function (nodeid, node, parentid, parent) {
      node.hasVisibleChildren = node.isVisible || node.hasVisibleChildren;
      if (parent != null) {
        parent.hasVisibleChildren = parent.hasVisibleChildren || node.hasVisibleChildren;
      }
    });

    orgTree.loopLevels(this, function (parentOrgItemId, parentOrgItem, levelid) {
      var logicalParentItem,
        regularChildrenLevels,
        shiftParent;
      if (!isFamilyChartMode && !parentOrgItem.hasVisibleChildren) {
        return orgTree.SKIP;
      }

      logicalParentItem = visualTree.node(parentOrgItemId);
      if (!logicalParentItem) {
        logicalParentItem = getNewTreeItem({
          visibility: primitives.common.Visibility.Invisible,
          connectorPlacement: 0,
          parentId: null,
          actualItemType: primitives.orgdiagram.ItemType.Regular
        }, parentOrgItem);
        visualTree.add(null, parentOrgItemId, logicalParentItem);
      }

			/* find left and right siblings margins of logical parent item
				they are needed to properly place GeneralPartner & LimitedPartner nodes. */
      leftSiblingOffset = 0;
      rightSiblingOffset = 0;
      if ((index = visualTree.indexOf(parentOrgItemId)) != null) {
        leftSiblingOffset = index;
        rightSiblingOffset = visualTree.countSiblings(parentOrgItemId) - index - 1;
      }

      /* populate children */
      regularChildrenLevels = []; /* children added after all other custom item types */
      orgTree.loopChildren(this, parentOrgItemId, function (orgItemId, orgItem, index) {
        if (isFamilyChartMode || orgItem.hasVisibleChildren) {
          treeItem = getNewTreeItem({
            parentId: parentOrgItemId,
            actualItemType: orgItem.itemType
          }, orgItem);

          switch (logicalParentItem.actualItemType) {
            case primitives.orgdiagram.ItemType.LimitedPartner:
            case primitives.orgdiagram.ItemType.AdviserPartner:
            case primitives.orgdiagram.ItemType.GeneralPartner:
              switch (treeItem.actualItemType) {
                case primitives.orgdiagram.ItemType.LimitedPartner:
                case primitives.orgdiagram.ItemType.AdviserPartner:
                case primitives.orgdiagram.ItemType.GeneralPartner:
                  /* Don't support partner of partner */
                  treeItem.actualItemType = primitives.orgdiagram.ItemType.Adviser;
                  break;
                case primitives.orgdiagram.ItemType.Regular:
                  /* Don't support regular children of partner */
                  treeItem.actualItemType = primitives.orgdiagram.ItemType.Assistant;
                  break;
              }
              break;
          }

          switch (treeItem.actualItemType) {
            case primitives.orgdiagram.ItemType.SubAdviser:
              defineNavigationParent(logicalParentItem, treeItem);
              treeItem.connectorPlacement = primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom;
              shiftParent = getNewTreeItem({ visibility: primitives.common.Visibility.Invisible });
              visualTree.add(shiftParent.id, treeItem.id, treeItem);
              treeItem = shiftParent;//ignore jslint
            case primitives.orgdiagram.ItemType.AdviserPartner://ignore jslint
            case primitives.orgdiagram.ItemType.Adviser://ignore jslint
              visualParent = visualTree.parent(parentOrgItemId);
              if (logicalParentItem.connectorPlacement & primitives.common.SideFlag.Right) {
                leftSiblingIndex = findLeftSiblingIndex(visualTree, _data.navigationFamily, logicalParentItem);
                visualTree.add(visualParent.id, treeItem.id, treeItem, leftSiblingIndex + 1);
                treeItem.connectorPlacement = primitives.common.SideFlag.Right | primitives.common.SideFlag.Bottom;
                treeItem.gravity = primitives.common.HorizontalAlignmentType.Right;
              } else if (logicalParentItem.connectorPlacement & primitives.common.SideFlag.Left) {
                rightSiblingIndex = findRightSiblingIndex(visualTree, _data.navigationFamily, logicalParentItem);
                visualTree.add(visualParent.id, treeItem.id, treeItem, rightSiblingIndex);
                treeItem.connectorPlacement = primitives.common.SideFlag.Left | primitives.common.SideFlag.Bottom;
                treeItem.gravity = primitives.common.HorizontalAlignmentType.Left;
              } else {
                switch (orgItem.adviserPlacementType) {
                  case primitives.common.AdviserPlacementType.Left:
                    leftSiblingIndex = findLeftSiblingIndex(visualTree, _data.navigationFamily, logicalParentItem);
                    visualTree.add(visualParent.id, treeItem.id, treeItem, leftSiblingIndex + 1);
                    treeItem.connectorPlacement = primitives.common.SideFlag.Right | primitives.common.SideFlag.Bottom;
                    treeItem.gravity = primitives.common.HorizontalAlignmentType.Right;
                    break;
                  default:
                    rightSiblingIndex = findRightSiblingIndex(visualTree, _data.navigationFamily, logicalParentItem);
                    visualTree.add(visualParent.id, treeItem.id, treeItem, rightSiblingIndex);
                    treeItem.connectorPlacement = primitives.common.SideFlag.Left | primitives.common.SideFlag.Bottom;
                    treeItem.gravity = primitives.common.HorizontalAlignmentType.Left;
                    break;
                }
              }

              switch (treeItem.actualItemType) {
                case primitives.orgdiagram.ItemType.SubAdviser:
                  break;
                case primitives.orgdiagram.ItemType.AdviserPartner:
                  if (logicalParentItem.parentId != null) {
                    defineNavigationParent(visualTree.node(logicalParentItem.parentId), treeItem);
                  } else {
                    defineNavigationParent(logicalParentItem, treeItem, true);
                  }
                  break;
                case primitives.orgdiagram.ItemType.Adviser:
                  defineNavigationParent(logicalParentItem, treeItem);
                  break;
              }
              break;
            case primitives.orgdiagram.ItemType.SubAssistant:
              defineNavigationParent(logicalParentItem, treeItem);
              treeItem.connectorPlacement = primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom;
              shiftParent = getNewTreeItem({ visibility: primitives.common.Visibility.Invisible });
              visualTree.add(shiftParent.id, treeItem.id, treeItem);
              treeItem = shiftParent;//ignore jslint
            case primitives.orgdiagram.ItemType.Assistant://ignore jslint
              var parent = createNewVisualAggregatorWithGivenDepth(visualTree, logicalParentItem, false, false, orgItem.levelOffset || 0)
              switch (orgItem.adviserPlacementType) {
                case primitives.common.AdviserPlacementType.Left:
                  visualTree.add(parent.id, treeItem.id, treeItem, 0);
                  treeItem.connectorPlacement = primitives.common.SideFlag.Right | primitives.common.SideFlag.Bottom;
                  treeItem.gravity = primitives.common.HorizontalAlignmentType.Right;
                  break;
                default:
                  visualTree.add(parent.id, treeItem.id, treeItem);
                  treeItem.connectorPlacement = primitives.common.SideFlag.Left | primitives.common.SideFlag.Bottom;
                  treeItem.gravity = primitives.common.HorizontalAlignmentType.Left;
                  break;
              }
              if (treeItem.actualItemType == primitives.orgdiagram.ItemType.Assistant) {
                defineNavigationParent(logicalParentItem, treeItem);
              }
              break;
            case primitives.orgdiagram.ItemType.Regular:
              var levelOffset = orgItem.levelOffset || 0;
              if (regularChildrenLevels[levelOffset] == null) {
                regularChildrenLevels[levelOffset] = [treeItem];
              } else {
                regularChildrenLevels[levelOffset].push(treeItem);
              }
              defineNavigationParent(logicalParentItem, treeItem);
              break;
            case primitives.orgdiagram.ItemType.LimitedPartner:
            case primitives.orgdiagram.ItemType.GeneralPartner:
              visualParent = visualTree.parent(parentOrgItemId);
              if (logicalParentItem.connectorPlacement & primitives.common.SideFlag.Right) {
                visualTree.add(visualParent.id, treeItem.id, treeItem, leftSiblingOffset);
                treeItem.connectorPlacement = primitives.common.SideFlag.Right | primitives.common.SideFlag.Bottom;
                treeItem.gravity = primitives.common.HorizontalAlignmentType.Right;
              } else if (logicalParentItem.connectorPlacement & primitives.common.SideFlag.Left) {
                visualTree.add(visualParent.id, treeItem.id, treeItem, visualTree.countChildren(visualParent.id) - rightSiblingOffset);
                treeItem.connectorPlacement = primitives.common.SideFlag.Left | primitives.common.SideFlag.Bottom;
                treeItem.gravity = primitives.common.HorizontalAlignmentType.Left;
              } else {
                switch (orgItem.adviserPlacementType) {
                  case primitives.common.AdviserPlacementType.Left:
                    visualTree.add(visualParent.id, treeItem.id, treeItem, leftSiblingOffset);
                    treeItem.gravity = primitives.common.HorizontalAlignmentType.Right;
                    break;
                  default:
                    visualTree.add(visualParent.id, treeItem.id, treeItem, visualTree.countChildren(visualParent.id) - rightSiblingOffset);
                    treeItem.gravity = primitives.common.HorizontalAlignmentType.Left;
                    break;
                }
                switch (treeItem.actualItemType) {
                  case primitives.orgdiagram.ItemType.GeneralPartner:
                    treeItem.connectorPlacement = primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom;
                    break;
                  case primitives.orgdiagram.ItemType.LimitedPartner:
                    treeItem.connectorPlacement = primitives.common.SideFlag.Bottom;
                    break;
                }
              }
              if (logicalParentItem.parentId != null) {
                defineNavigationParent(visualTree.node(logicalParentItem.parentId), treeItem);
              } else {
                defineNavigationParent(logicalParentItem, treeItem, true);
              }
              break;
          }
        }
      });

      /* collect partners, add logicalParentItem into partners collection */
      switch (logicalParentItem.actualItemType) {
        case primitives.orgdiagram.ItemType.LimitedPartner:
        case primitives.orgdiagram.ItemType.AdviserPartner:
        case primitives.orgdiagram.ItemType.GeneralPartner:
          break;
        default:
          tempPartners = [];
          if ((visualParent = visualTree.parent(parentOrgItemId)) != null) {
            visualTree.loopChildrenRange(this, visualParent.id, leftSiblingOffset, visualTree.countChildren(visualParent.id) - rightSiblingOffset, function (childItemId, childItem, index) {
              if (childItem.id == parentOrgItemId) {
                tempPartners.push(childItem);
              } else {
                switch (childItem.actualItemType) {
                  case primitives.orgdiagram.ItemType.LimitedPartner:
                  case primitives.orgdiagram.ItemType.AdviserPartner:
                  case primitives.orgdiagram.ItemType.GeneralPartner:
                    if (orgTree.parentid(childItem.id) == parentOrgItemId) {
                      tempPartners.push(childItem);
                    }
                    break;
                }
              }
            });
          }
          if (tempPartners.length > 1) {
            partners[parentOrgItemId] = tempPartners;
          }
          break;
      }

      rowAggregators[parentOrgItemId] = [];
      rowChildren[parentOrgItemId] = [];

      var aggregators = [];
      if (regularChildrenLevels.length > 0) {
        var visualParent = getLastVisualAggregator(visualTree, logicalParentItem);
        for (var indexLevel = 0; indexLevel < regularChildrenLevels.length - 1; indexLevel += 1) {
          var regularChildrenLevel = regularChildrenLevels[indexLevel];
          if (regularChildrenLevel != null) {
            var hideChildConnector = (logicalParentItem.visibility == primitives.common.Visibility.Invisible) && (logicalParentItem.connectorPlacement === 0);
            nextVisualParent = createNewVisualAggregator(visualTree, visualParent, hideChildConnector);

            aggregators.push([nextVisualParent]);


            var medianIndex = 0;
            switch (options.horizontalAlignment) {
              case primitives.common.HorizontalAlignmentType.Center:
                medianIndex = Math.ceil(regularChildrenLevel.length / 2) - 1;
                break;
              case primitives.common.HorizontalAlignmentType.Left:
                medianIndex = -1;
                break;
              case primitives.common.HorizontalAlignmentType.Right:
                medianIndex = regularChildrenLevel.length - 1;
                break;
            }

            for (index = medianIndex; index >= 0; index -= 1) {
              var item = regularChildrenLevel[index];
              visualTree.add(visualParent.id, item.id, item, 0);
              item.connectorPlacement = primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom;
              item.gravity = primitives.common.HorizontalAlignmentType.Right;
            }

            for (index = medianIndex + 1; index < regularChildrenLevel.length; index += 1) {
              var item = regularChildrenLevel[index];
              visualTree.add(visualParent.id, item.id, item);
              item.connectorPlacement = primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom;
              item.gravity = primitives.common.HorizontalAlignmentType.Left;
            }

            visualParent = nextVisualParent;
          }
        }

        /* add children */
        var regularChildren = regularChildrenLevels[regularChildrenLevels.length - 1];
        layoutChildren(orgTree, visualTree, options, logicalParentItem, regularChildren, parentOrgItem.childrenPlacementType, rowAggregators[parentOrgItemId], rowChildren[parentOrgItemId]);

        rowAggregators[parentOrgItemId] = rowAggregators[parentOrgItemId].concat(aggregators);
        rowChildren[parentOrgItemId] = rowChildren[parentOrgItemId].concat(regularChildrenLevels.slice(0, regularChildrenLevels.length - 1));
      }
    });

    /* transform tree to place children sub branches inside of hierarchy */
    orgTree.loopPostOrder(this, function (nodeid, node, parentid, parent) {
      var logicalParentItem = visualTree.node(nodeid),
        itemRowChildren,
        itemRowAggregators,
        hasChildren,
        hasPartners = (partners[parentid] != null),
        extendChildren;
      if (logicalParentItem != null) {
        itemRowChildren = rowChildren[nodeid];
        itemRowAggregators = rowAggregators[nodeid];

        /* Move assistants children inside */
        if (parent != null) {
          extendChildren = hasPartners;
          switch (parent.placeAssistantsAboveChildren) {
            case primitives.common.Enabled.Auto:
              if (options.placeAssistantsAboveChildren) {
                extendChildren = true;
              }
              break;
            case primitives.common.Enabled.True:
              extendChildren = true
              break;
          }

          if (extendChildren) {
            depth = getAssitantsDepth(visualTree, logicalParentItem);
            if (depth > 0) {
              logicalParentItem.visualDepth = depth + 1;
              if (logicalParentItem.visualAggregatorId !== null) {
                visualAggregator = visualTree.node(logicalParentItem.visualAggregatorId);
                hasChildren = visualTree.hasChildren(visualAggregator.id);
                for (index = 0; index < depth - 1; index += 1) {
                  visualAggregator = createNewVisualAggregator(visualTree, visualAggregator, !hasChildren);
                }
              }
            }
          }
        }
        /* Move advisers children inside */
        if (parent != null) {
          extendChildren = hasPartners;
          switch (parent.placeAdvisersAboveChildren) {
            case primitives.common.Enabled.Auto:
              if (options.placeAdvisersAboveChildren) {
                extendChildren = true;
              }
              break;
            case primitives.common.Enabled.True:
              extendChildren = true
              break;
          }
          if (extendChildren) {
            depth = getAdvisersDepth(visualTree, logicalParentItem);
            if (depth > 1) {
              logicalParentItem.visualDepth += (depth - 1);
              hasChildren = visualTree.hasChildren(nodeid);
              visualAggregator = logicalParentItem;
              for (index = 0; index < depth - 1; index += 1) {
                visualAggregator = createNewVisualAggregator(visualTree, visualAggregator, !hasChildren);
              }
            }
          }
        }
        /* Move children of children inside */
        rowDepths = [];
        for (index = 0, len = itemRowChildren.length; index < len; index += 1) {
          children = itemRowChildren[index];
          rowDepths[index] = 0;
          for (childIndex = 0, childrenLen = children.length; childIndex < childrenLen; childIndex += 1) {
            rowDepths[index] = Math.max(rowDepths[index], getItemDepth(visualTree, children[childIndex]));
          }
        }

        for (index = 0, len = rowDepths.length; index < len; index += 1) {
          rowDepth = rowDepths[index];
          if (rowDepth > 1) {
            for (childIndex = 0, childrenLen = itemRowAggregators[index].length; childIndex < childrenLen; childIndex += 1) {
              rowAggregator = itemRowAggregators[index][childIndex];
              if (visualTree.hasChildren(rowAggregator.id)) {
                depth = rowDepth;
                while (depth > 1) {
                  rowAggregator = createNewVisualAggregator(visualTree, rowAggregator, false);
                  depth -= 1;
                }
              }
            }
          }
        }

        /* Align heights of partner branches in order to draw connector lines between them and logical parent children */
        if (partners[nodeid] != null) {
          /* partners collection includes treeItem so we should have at least 2 items */
          layoutPartners(visualTree, logicalParentItem, partners[nodeid]);
        }
      }
    });
  }

  function layoutPartners(visualTree, treeItem, partners) {
    var partner,
      index, len,
      depth,
      maxDepth = 0,
      visualPartners = [],
      visualPartner,
      visualParent,
      visualAggregator,
      leftSiblingIndex,
      gravity;

    /* Find maximum depth required to enclose partners branches */
    for (index = 0, len = partners.length; index < len; index += 1) {
      partner = partners[index];
      maxDepth = Math.max(maxDepth, partner.visualDepth);
    }

    /* Extend visual aggregators lines and ensure that connector lines are visible */
    for (index = 0, len = partners.length; index < len; index += 1) {
      partner = partners[index];
      visualPartner = getLastVisualAggregator(visualTree, partner);
      depth = 1;
      visualAggregator = partner;
      while (visualAggregator.visualAggregatorId != null) {
        visualAggregator = visualTree.node(visualAggregator.visualAggregatorId);
        visualAggregator.connectorPlacement = primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom;
        depth += 1;
      }
      while (depth < maxDepth) {
        visualPartner = createNewVisualAggregator(visualTree, visualPartner, false);
        depth += 1;
      }
      visualPartners.push(getLastVisualAggregator(visualTree, visualPartner).id);
    }


    visualAggregator = getLastVisualAggregator(visualTree, treeItem);
    if (visualTree.hasChildren(visualAggregator.id)) {
      /* Select middle partner */
      visualPartner = partners[Math.floor(partners.length / 2)];
      if (partners.length > 1 && partners.length % 2 === 0) {
        /* insert invisble partner for alignemnt */
        visualParent = visualTree.parent(visualPartner.id);
        leftSiblingIndex = findLeftSiblingIndex(visualTree, _data.navigationFamily, visualPartner);

        gravity = visualTree.getChild(visualParent.id, leftSiblingIndex).gravity ||
          visualTree.getChild(visualParent.id, leftSiblingIndex + 1).gravity;

        // visualParent.id,
        visualPartner = getNewTreeItem({
          visibility: primitives.common.Visibility.Invisible,
          connectorPlacement: visualPartner.connectorPlacement & (primitives.common.SideFlag.Left | primitives.common.SideFlag.Right),
          gravity: gravity
        });

        visualTree.add(visualParent.id, visualPartner.id, visualPartner, leftSiblingIndex + 1);

        depth = 1;
        while (depth < maxDepth) {
          visualPartner = createNewVisualAggregator(visualTree, visualPartner, false);
          visualPartner.connectorPlacement = 0;
          depth += 1;
        }
      }

      /* every child logically belongs to every partner */
      for (index = 0, len = partners.length; index < len; index += 1) {
        partner = partners[index];
        /* select all parents up to the root */
        _data.navigationFamily.loopChildren(this, treeItem.id, function (childItemId, childItem, level) {
          switch (childItem.actualItemType) {
            case primitives.orgdiagram.ItemType.SubAdviser:
            case primitives.orgdiagram.ItemType.Adviser:
            case primitives.orgdiagram.ItemType.SubAssistant:
            case primitives.orgdiagram.ItemType.Assistant:
              break;
            default:
              /* partners share only regular items */
              if (treeItem.id != partner.id) {
                defineNavigationParent(partner, childItem);
              }
              break;
          }
          return _data.navigationFamily.SKIP;
        }); //ignore jslint
      }

      /* Move children to new visual partner node */
      visualPartner = getLastVisualAggregator(visualTree, visualPartner);
      visualTree.moveChildren(visualAggregator.id, visualPartner.id);
    }

    /* Store collection of visual partners to draw connector lines*/
    visualPartner.partners = visualPartners;
  }

  function getLastVisualAggregator(visualTree, treeItem) {
    var result = treeItem;

    while (result.visualAggregatorId != null) {
      result = visualTree.node(result.visualAggregatorId);
    }
    return result;
  }

  function getAdvisersDepth(visualTree, treeItem) {
    var result = 0,
      parentItem = visualTree.parent(treeItem.id),
      treeItemIndex,
      position,
      childItem;
    if (parentItem !== null) {
      treeItemIndex = visualTree.indexOf(treeItem.id);

      position = 1;
      while ((childItem = visualTree.getChild(parentItem.id, treeItemIndex + position)) != null) {
        if (childItem.connectorPlacement & primitives.common.SideFlag.Left) {
          result = Math.max(result, getItemDepth(visualTree, childItem));
          position += 1;
        }
        else {
          break;
        }
      }
      position = 1;
      while ((childItem = visualTree.getChild(parentItem.id, treeItemIndex - position)) != null) {
        if (childItem.connectorPlacement & primitives.common.SideFlag.Right) {
          result = Math.max(result, getItemDepth(visualTree, childItem));
          position += 1;
        }
        else {
          break;
        }
      }
    }
    return result;
  }

  function getAssitantsDepth(visualTree, treeItem) {
    var result = 0;
    if (treeItem.visualAggregatorId != null) {
      visualTree.loopLevels(this, treeItem.id, function (childItemId, childItem, level) {
        if (treeItem.visualAggregatorId == childItemId) {
          return visualTree.SKIP;
        }
        result = level + 1;
      });
    }
    return result;
  }

  function getItemDepth(visualTree, treeItem) {
    var result = 0;
    visualTree.loopLevels(this, treeItem.id, function (childid, child, level) {
      result = level + 1;
    });
    return result + 1;
  }

  function layoutChildren(orgTree, visualTree, options, treeItem, regularChildren, childrenPlacementType, rowAggregators, rowChildren) {
    var visualParent,
      currentVisualParent,
      leftChildItem,
      rightChildItem,
      newAggregatorItem,
      childItem, orgChildItem,
      width,
      height,
      twinColumns,
      column,
      row,
      index, len,
      singleItemPlacement,
      hideParentConnector = (treeItem.visibility == primitives.common.Visibility.Invisible) && (treeItem.connectorPlacement === 0);

    switch (options.horizontalAlignment) {
      case primitives.common.HorizontalAlignmentType.Center:
      case primitives.common.HorizontalAlignmentType.Left:
        singleItemPlacement = primitives.common.AdviserPlacementType.Right;
        break;
      case primitives.common.HorizontalAlignmentType.Right:
        singleItemPlacement = primitives.common.AdviserPlacementType.Left;
        break;
    }

    if (childrenPlacementType === primitives.common.ChildrenPlacementType.Auto) {
      if (hasRegularLeavesOnly(orgTree, treeItem)) {
        childrenPlacementType = (options.leavesPlacementType === primitives.common.ChildrenPlacementType.Auto) ?
          primitives.common.ChildrenPlacementType.Matrix : options.leavesPlacementType;
      }
      else {
        childrenPlacementType = (options.childrenPlacementType === primitives.common.ChildrenPlacementType.Auto) ?
          primitives.common.ChildrenPlacementType.Horizontal : options.childrenPlacementType;
      }
    }

    visualParent = getLastVisualAggregator(visualTree, treeItem);

    if (childrenPlacementType == primitives.common.ChildrenPlacementType.Matrix && regularChildren.length < 3) {
      childrenPlacementType = primitives.common.ChildrenPlacementType.Horizontal;
    }

    switch (childrenPlacementType) {
      case primitives.common.ChildrenPlacementType.Horizontal:
        for (index = 0, len = regularChildren.length; index < len; index += 1) {
          childItem = regularChildren[index];
          orgChildItem = orgTree.node(childItem.id);
          visualTree.add(visualParent.id, childItem.id, childItem);
          childItem.connectorPlacement = (orgChildItem.hideParentConnection ? 0 : primitives.common.SideFlag.Top) | (orgChildItem.hideChildrenConnection ? 0 : primitives.common.SideFlag.Bottom);

          if (index === 0) {
            childItem.relationDegree = 1;
          }
        }
        break;
      case primitives.common.ChildrenPlacementType.Matrix:
        width = Math.min(options.maximumColumnsInMatrix, Math.ceil(Math.sqrt(regularChildren.length)));
        height = Math.ceil(regularChildren.length / width);
        twinColumns = Math.ceil(width / 2.0);
        for (column = 0; column < twinColumns; column += 1) {
          currentVisualParent = visualParent;
          for (row = 0; row < height; row += 1) {
            leftChildItem = getMatrixItem(regularChildren, column * 2, row, width);
            rightChildItem = getMatrixItem(regularChildren, column * 2 + 1, row, width);
            if (rowAggregators[row] === undefined) {
              rowAggregators[row] = [];
              rowChildren[row] = [];
            }
            if (leftChildItem !== null) {
              if (column === 0) {
                leftChildItem.relationDegree = 1;
              }
              visualTree.add(currentVisualParent.id, leftChildItem.id, leftChildItem);
              leftChildItem.connectorPlacement = (hideParentConnector ? 0 : primitives.common.SideFlag.Right) | primitives.common.SideFlag.Bottom;
              leftChildItem.gravity = primitives.common.HorizontalAlignmentType.Right;

              rowChildren[row].push(leftChildItem);
            }
            if (leftChildItem !== null || rightChildItem !== null) {
              // currentVisualParent.id,
              newAggregatorItem = getNewTreeItem({
                visibility: primitives.common.Visibility.Invisible,
                connectorPlacement: hideParentConnector ? 0 : primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom
              });
              visualTree.add(currentVisualParent.id, newAggregatorItem.id, newAggregatorItem);
              rowAggregators[row].push(newAggregatorItem);
            }
            if (rightChildItem !== null) {
              visualTree.add(currentVisualParent.id, rightChildItem.id, rightChildItem);
              rightChildItem.connectorPlacement = (hideParentConnector ? 0 : primitives.common.SideFlag.Left) | primitives.common.SideFlag.Bottom;
              rightChildItem.gravity = primitives.common.HorizontalAlignmentType.Left;

              rowChildren[row].push(rightChildItem);
            }

            currentVisualParent = newAggregatorItem;
          }
        }
        if (width > 2) {
          // No center alignment to aggregator required
          visualParent.visualAggregatorId = null;
        }
        break;
      case primitives.common.ChildrenPlacementType.Vertical:
        for (index = 0, len = regularChildren.length; index < len; index += 1) {
          childItem = regularChildren[index];

          // visualParent.id,
          newAggregatorItem = getNewTreeItem({
            visibility: primitives.common.Visibility.Invisible,
            connectorPlacement: hideParentConnector ? 0 : primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom
          });


          switch (singleItemPlacement) {
            case primitives.common.AdviserPlacementType.Left:
              visualTree.add(visualParent.id, childItem.id, childItem);
              visualTree.add(visualParent.id, newAggregatorItem.id, newAggregatorItem);
              childItem.connectorPlacement = (hideParentConnector ? 0 : primitives.common.SideFlag.Right) | primitives.common.SideFlag.Bottom;
              childItem.gravity = primitives.common.HorizontalAlignmentType.Right;
              break;
            case primitives.common.AdviserPlacementType.Right:
              visualTree.add(visualParent.id, newAggregatorItem.id, newAggregatorItem);
              visualTree.add(visualParent.id, childItem.id, childItem);
              childItem.connectorPlacement = (hideParentConnector ? 0 : primitives.common.SideFlag.Left) | primitives.common.SideFlag.Bottom;
              childItem.gravity = primitives.common.HorizontalAlignmentType.Left;
              break;
          }

          rowAggregators[index] = [newAggregatorItem];
          rowChildren[index] = [childItem];

          visualParent = newAggregatorItem;
        }
        break;
      default:
        throw "Children placement is undefined!";
    }
  }

  function getMatrixItem(items, x, y, width) {
    var result,
      isOdd = (width % 2 > 0),
      index;

    if (isOdd) {
      if (x === width - 1) {
        x = items.length;
      }
      else if (x === width) {
        x = width - 1;
      }
    }
    index = y * width + x;

    result = (index > items.length - 1) ? null : items[index];

    return result;
  }

  function hasRegularLeavesOnly(orgTree, treeItem) {
    var hasChildren = false,
      hasLeavesOnly = true;

    orgTree.loopChildren(this, treeItem.id, function (nodeid, node, index) {
      hasChildren = true;
      if (node.itemType === primitives.orgdiagram.ItemType.Regular &&
        orgTree.hasChildren(nodeid)) {
        hasLeavesOnly = false;
        return true; // break
      }
    });
    return hasChildren && hasLeavesOnly;
  }

  /* Sibling is the first item which does not belongs to items logical hierarchy */
  function findLeftSiblingIndex(visualTree, navigationFamily, treeItem) {
    var result = null,
      ignore = {},
      visualParent = visualTree.parent(treeItem.id);

    visualTree.loopChildrenReversed(this, visualParent.id, function (childItemId, childItem, index) {
      if (result === null) {
        if (childItemId == treeItem.id) {
          result = -1;
          ignore[treeItem.id] = true;
          navigationFamily.loopChildren(this, treeItem.id, function (childid, child, level) {
            if (level > 0) {
              return navigationFamily.BREAK;
            }
            ignore[childid] = true;
          });
        }
      }
      else {
        if (!ignore.hasOwnProperty(childItemId)) {
          result = index;
          return true; //ignore jslint
        } else {
          navigationFamily.loopChildren(this, childItem.id, function (childid, child, level) {
            if (level > 0) {
              return navigationFamily.BREAK;
            }
            ignore[childid] = true;
          });
        }
      }
    });

    return result;
  }

  /* Sibling is the first item which does not belongs to items logical hierarchy */
  function findRightSiblingIndex(visualTree, navigationFamily, treeItem) {
    var result = null,
      ignore = {},
      visualParent = visualTree.parent(treeItem.id);

    visualTree.loopChildren(this, visualParent.id, function (childItemId, childItem, index, lastIndex) {
      if (result === null) {
        if (childItemId == treeItem.id) {
          result = lastIndex + 1;
          ignore[treeItem.id] = true;
          navigationFamily.loopChildren(this, treeItem.id, function (childid, child, level) {
            if (level > 0) {
              return navigationFamily.BREAK;
            }
            ignore[childid] = true;
          });
        }
      }
      else {
        if (!ignore.hasOwnProperty(childItemId)) {
          result = index;
          return true; //ignore jslint
        } else {
          navigationFamily.loopChildren(this, childItemId, function (childid, child, level) {
            if (level > 0) {
              return navigationFamily.BREAK;
            }
            ignore[childid] = true;
          });
        }
      }
    });
    return result;
  }

  function createNewVisualAggregatorWithGivenDepth(visualTree, treeItem, hideParentConnector, hideChildrenConnector, depth) {
    var result = null,
      newAggregatorItem,
      hideParentConnector = hideParentConnector || hideChildrenConnector;

    var index = 0;
    while (index <= depth) {
      if (result == null) {
        result = treeItem;
      } else {
        result = visualTree.node(result.visualAggregatorId);
      }
      if (result.visualAggregatorId == null) {
        newAggregatorItem = getNewTreeItem({
          visibility: primitives.common.Visibility.Invisible,
          visualAggregatorId: null,
          connectorPlacement: hideParentConnector ? 0 : (primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom)
        });
        visualTree.insert(result.id, newAggregatorItem.id, newAggregatorItem);
        result.visualAggregatorId = newAggregatorItem.id;
      }
      index += 1;
    }
    return result;
  }

  function createNewVisualAggregator(visualTree, treeItem, hideChildrenConnector) {
    var newAggregatorItem,
      hideParentConnector = ((treeItem.visibility == primitives.common.Visibility.Invisible) && (treeItem.connectorPlacement === 0)) || hideChildrenConnector;

    newAggregatorItem = getNewTreeItem({
      visibility: primitives.common.Visibility.Invisible,
      visualAggregatorId: treeItem.visualAggregatorId,
      connectorPlacement: hideParentConnector ? 0 : (primitives.common.SideFlag.Top | primitives.common.SideFlag.Bottom)
    });

    visualTree.insert(treeItem.id, newAggregatorItem.id, newAggregatorItem);

    treeItem.visualAggregatorId = newAggregatorItem.id;
    return newAggregatorItem;
  }

  function getNewTreeItem(properties, orgItem) {
    var result = new primitives.orgdiagram.TreeItem(),
      optionKey;

    for (optionKey in properties) {
      if (properties.hasOwnProperty(optionKey)) {
        result[optionKey] = properties[optionKey];
      }
    }

    if (orgItem != null) {
      result.id = orgItem.id;
      result.visibility = orgItem.isVisible ? primitives.common.Visibility.Auto : primitives.common.Visibility.Invisible;
    } else {
      _treeItemCounter += 1;
      result.id = _treeItemCounter;
    }

    return result;
  }

  function defineNavigationParent(parentItem, treeItem, skipFirstParent) {
    var parents = [];

    /* take logicalParentItem when it is visible or collect all visible immidiate parents of logicalParentItem */
    if (skipFirstParent || parentItem.visibility == primitives.common.Visibility.Invisible || !_activeItems.hasOwnProperty(parentItem.id)) {
      if (!skipFirstParent) {
        parents.push(parentItem.id);
      }
      _data.navigationFamily.loopParents(this, parentItem.id, function (parentid, parent, level) {
        if (parent.visibility != primitives.common.Visibility.Invisible) {
          parents.push(parentid);
          if (_activeItems.hasOwnProperty(parentid)) {
            return _data.navigationFamily.SKIP;
          }
        }
      });
    } else {
      parents.push(parentItem.id);
    }
    if (_data.navigationFamily.node(treeItem.id) != null) {
      _data.navigationFamily.adopt(parents, treeItem.id);
    } else {
      _data.navigationFamily.add(parents, treeItem.id, treeItem);
    }
  }

  function updateVisualTreeMargins(visualTree, leftMargins, rightMargins) {
    visualTree.loop(this, function (nodeid, node) {
      leftMargins[nodeid] = [];
      rightMargins[nodeid] = [];
    });

    visualTree.loopPostOrder(this, function (nodeid, node, parentid, parent) {
      var parentLeftMargins = leftMargins[parentid],
        parentRightMargins = rightMargins[parentid],
        nodeLeftMargins = leftMargins[nodeid],
        nodeRightMargins = rightMargins[nodeid],
        index, len;

      if (parentid != null) {
        /* update parent left margins */
        if (!parentLeftMargins[0]) {
          parentLeftMargins[0] = nodeid;
        }

        for (index = 0, len = nodeLeftMargins.length; index < len; index += 1) {
          if (!parentLeftMargins[index + 1]) {
            parentLeftMargins[index + 1] = nodeLeftMargins[index];
          }
        }

        /* update parent rights margins */
        parentRightMargins[0] = nodeid;

        for (index = 0, len = nodeRightMargins.length; index < len; index += 1) {
          parentRightMargins[index + 1] = nodeRightMargins[index];
        }
      }
    });
  }

  function getVisualTree() {
    return _data.visualTree;
  }

  function getNavigationFamily() {
    return _data.navigationFamily;
  }

  function getConnectionsFamily() {
    return _data.connectionsFamily;
  }

  function getLeftMargins() {
    return _data.leftMargins;
  }

  function getRightMargins() {
    return _data.rightMargins;
  }

  return {
    process: process,
    getVisualTree: getVisualTree,
    getNavigationFamily: getNavigationFamily,
    getConnectionsFamily: getConnectionsFamily,
    getLeftMargins: getLeftMargins,
    getRightMargins: getRightMargins
  };
};