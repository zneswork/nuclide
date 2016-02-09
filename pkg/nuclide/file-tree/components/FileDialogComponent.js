'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import AtomInput from '../../ui/atom-input';
import NuclideCheckbox from '../../ui/checkbox';
import {CompositeDisposable} from 'atom';
import {
  React,
  ReactDOM,
} from 'react-for-atom';

import pathModule from 'path';

const {PropTypes} = React;

/**
 * Component that displays UI to create a new file.
 */
class FileDialogComponent extends React.Component {
  _subscriptions: CompositeDisposable;
  _isClosed: boolean;

  static propTypes = {
    iconClassName: PropTypes.string,
    initialValue: PropTypes.string,
    // Message is displayed above the input.
    message: PropTypes.element.isRequired,
    // Will be called (before `onClose`) if the user confirms.  `onConfirm` will
    // be called with two arguments, the value of the input field and a map of
    // option name => bool (true if option was selected).
    onConfirm: PropTypes.func.isRequired,
    // Will be called regardless of whether the user confirms.
    onClose: PropTypes.func.isRequired,
    // Whether or not to initially select the base name of the path.
    // This is useful for renaming files.
    selectBasename: PropTypes.bool,
    // Extra options to show the user.  Key is the name of the option and value
    // is a description string that will be displayed.
    additionalOptions: PropTypes.objectOf(PropTypes.string),
  };

  static defaultProps = {
    additionalOptions: {},
  };

  constructor() {
    super(...arguments);
    this._isClosed = false;
    this._subscriptions = new CompositeDisposable();
    this._close = this._close.bind(this);
    this._confirm = this._confirm.bind(this);
    this._handleDocumentClick = this._handleDocumentClick.bind(this);
    this.state = {
      options: {},
    };
    for (const name in this.props.additionalOptions) {
      this.state.options[name] = true;
    }
  }

  componentDidMount(): void {
    const input = this.refs.input;
    this._subscriptions.add(atom.commands.add(
      ReactDOM.findDOMNode(input),
      {
        'core:confirm': this._confirm,
        'core:cancel': this._close,
      }
    ));
    const path = this.props.initialValue;
    input.focus();
    if (this.props.selectBasename) {
      const {dir, name} = pathModule.parse(path);
      const selectionStart = dir ? dir.length + 1 : 0;
      const selectionEnd = selectionStart + name.length;
      input.getTextEditor().setSelectedBufferRange([[0, selectionStart], [0, selectionEnd]]);
    }
    document.addEventListener('click', this._handleDocumentClick);
  }

  componentWillUnmount(): void {
    this._subscriptions.dispose();
    document.removeEventListener('click', this._handleDocumentClick);
  }

  render(): ReactElement {
    let labelClassName;
    if (this.props.iconClassName != null) {
      labelClassName = `icon ${this.props.iconClassName}`;
    }

    const checkboxes = [];
    for (const name in this.props.additionalOptions) {
      const message = this.props.additionalOptions[name];
      const checked = this.state.options[name];
      const checkbox =
        <NuclideCheckbox
          key={name}
          checked={checked}
          onChange={this._handleAdditionalOptionChanged.bind(this, name)}
          label={message}
        />;
      checkboxes.push(checkbox);
    }

    // `.tree-view-dialog` is unstyled but is added by Atom's tree-view package[1] and is styled by
    // 3rd-party themes. Add it to make this package's modals styleable the same as Atom's
    // tree-view.
    //
    // [1] https://github.com/atom/tree-view/blob/v0.200.0/lib/dialog.coffee#L7
    return (
      <atom-panel class="modal overlay from-top">
        <div className="tree-view-dialog" ref="dialog">
          <label className={labelClassName}>{this.props.message}</label>
          <AtomInput
            initialValue={this.props.initialValue}
            ref="input"
          />
          {checkboxes}
        </div>
      </atom-panel>
    );
  }

  _handleAdditionalOptionChanged(name: string, isChecked: boolean): void {
    const {options} = this.state;
    options[name] = isChecked;
    this.setState({options: options});
  }

  _handleDocumentClick(event: Event): void {
    const dialog = this.refs['dialog'];
    // If the click did not happen on the dialog or on any of its descendants,
    // the click was elsewhere on the document and should close the modal.
    if (event.target !== dialog && !dialog.contains(event.target)) {
      this._close();
    }
  }

  _confirm() {
    this.props.onConfirm(this.refs.input.getText(), this.state.options);
    this._close();
  }

  _close() {
    if (!this._isClosed) {
      this._isClosed = true;
      this.props.onClose();
    }
  }
}

module.exports = FileDialogComponent;
