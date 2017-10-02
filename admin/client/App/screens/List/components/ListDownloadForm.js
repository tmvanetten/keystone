import React, { PropTypes } from 'react';
import assign from 'object-assign';
import { connect } from 'react-redux';
import xhr from 'xhr';
import Popout from '../../../shared/Popout';
import PopoutList from '../../../shared/Popout/PopoutList';
import ListHeaderButton from './ListHeaderButton';
import { LabelledControl, Form, FormField, FormInput, SegmentedControl, Modal, Button, Spinner, Alert } from '../../../elemental';
import { downloadItems } from '../actions';
const FORMAT_OPTIONS = [
	{ label: 'CSV', value: 'csv' },
	{ label: 'JSON', value: 'json' },
	{ label: 'GSheets', value: 'sheets' },
];

const GSHEET_ID_FILTER = /http[s]?:\/\/docs\.google\.com\/spreadsheets\/d\/(.+)\/.*/;

var ListDownloadForm = React.createClass({
	propTypes: {
		activeColumns: PropTypes.array,
		dispatch: PropTypes.func.isRequired,
		list: PropTypes.object,
	},
	getInitialState () {
		return {
			format: FORMAT_OPTIONS[0].value,
			isOpen: false,
			isModalOpen: false,
			downloadURL: null,
			downloadData: null,
			gapiKey: '',
			gClientID: '',
			gSheetID: '',
			gSheetSendState: 'loading',
			gSheetStatus: 'none',
			gSheetError: null,
			useCurrentColumns: true,
			selectedColumns: this.getDefaultSelectedColumns(),
		};
	},
	getDefaultSelectedColumns () {
		var selectedColumns = {};
		this.props.activeColumns.forEach(col => {
			selectedColumns[col.path] = true;
		});
		return selectedColumns;
	},
	getListUIElements () {
		return this.props.list.uiElements.map((el) => {
			return el.type === 'field' ? {
				type: 'field',
				field: this.props.list.fields[el.field],
			} : el;
		});
	},
	allColumnsSelected () {
		const selectedColumns = Object.keys(this.state.selectedColumns).length;
		const columnAmount = this.getListUIElements().filter((el) => el.type !== 'heading').length;
		return selectedColumns === columnAmount;
	},
	togglePopout (visible) {
		this.setState({
			isOpen: visible,
		});
	},
	toggleColumn (column, value) {
		const newColumns = assign({}, this.state.selectedColumns);
		if (value) {
			newColumns[column] = value;
		} else {
			delete newColumns[column];
		}
		this.setState({
			selectedColumns: newColumns,
		});
	},
	changeFormat (value) {
		this.setState({
			format: value,
		});
	},
	toggleCurrentlySelectedColumns (e) {
		const newState = {
			useCurrentColumns: e.target.checked,
			selectedColumns: this.getDefaultSelectedColumns(),
		};
		this.setState(newState);
	},
	clickSelectAll () {
		if (this.allColumnsSelected()) {
			this.selectNoColumns();
		} else {
			this.selectAllColumns();
		}
	},
	selectAllColumns () {
		const newColumns = {};
		this.getListUIElements().map((el) => {
			if (el.type !== 'heading') {
				newColumns[el.field.path] = true;
			}
		});
		this.setState({
			selectedColumns: newColumns,
		});
	},
	selectNoColumns () {
		this.setState({
			selectedColumns: {},
		});
	},

	modalClose () {
		this.setState({ isModalOpen: false });
	},

	onGAPIKey (ev) {
		this.setState({ gapiKey: ev.target.value });
	},

	onGClientID (ev) {
		this.setState({ gClientID: ev.target.value });
	},

	onGSheetID (ev) {
		this.setState({ gSheetID: ev.target.value });
	},

	updateSignInStatus (isSignedIn) {
		if (isSignedIn) {
			const { downloadData, gSheetID } = this.state;
			const ID_FILTER_MATCH = gSheetID.match(GSHEET_ID_FILTER);
			let sheetID = gSheetID;
			if (ID_FILTER_MATCH !== null) {
				sheetID = ID_FILTER_MATCH[1];
			}
			const dataInJSON = JSON.parse(downloadData);
			let dataTable = [];
			const columns = Object.keys(dataInJSON[0].fields);
			dataTable.push(columns);
			dataInJSON.forEach(row => {
				let rowArray = [];
				columns.forEach(field => {
					const data = row.fields[field];
					rowArray.push(data);
				});
				dataTable.push(rowArray);
			});
			const fromCell = 'A1';
			const range = `${fromCell}`;
			gapi.client.sheets.spreadsheets.values.update({
				spreadsheetId: sheetID,
				range: range,
				majorDimension: 'ROWS',
				valueInputOption: 'RAW',
				values: dataTable,
			}).then(res => {
				this.setState({ gSheetStatus: 'done', gSheetSendState: 'ready' });
			}).catch(err => {
				console.log(err);
				const message = err.result.error.message;
				this.setState({ gSheetStatus: 'error', gSheetError: message, gSheetSendState: 'ready' });
			});
		} else {
			gapi.auth2.getAuthInstance().signIn();
		}
	},
	submitGSheet () {
		const { gapiKey, gClientID } = this.state;
		this.setState({ gSheetStatus: 'pending', gSheetSendState: 'submitting' });
		const discoveryDocs = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
		const apiScopes = 'https://www.googleapis.com/auth/spreadsheets';
		gapi.load('client:auth2', () => {
			gapi.client.init({
				apiKey: gapiKey,
				clientId: gClientID,
				discoveryDocs: discoveryDocs,
				scope: apiScopes,
			}).then(() => {
				gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSignInStatus);
				this.updateSignInStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
			}).catch(err => {
				console.log(err);
				const message = 'Please check your data.';
				this.setState({ gSheetStatus: 'error', gSheetError: message, gSheetSendState: 'ready' });
			});
		});
	},

	handleDownloadRequest () {
		if (this.state.format === FORMAT_OPTIONS[2].value) {
			const { list, active } = this.props;
			const columns = Object.keys(this.state.selectedColumns);
			const url = list.getDownloadURL({
				search: active.search,
				filters: active.filters,
				sort: active.sort,
				columns: columns ? list.expandColumns(columns) : active.columns,
				format: 'json',
			});
			xhr(url, (err, resp, body) => {
				if (err) {
					this.setState({ gSheetError: err });
				} else {
					this.setState({ downloadData: body, gSheetSendState: 'ready' });
				}
			});
			this.setState({ isModalOpen: true, downloadURL: url, isOpen: false });
		} else {
			this.props.dispatch(downloadItems(this.state.format, Object.keys(this.state.selectedColumns)));
			this.togglePopout(false);
		}
	},
	renderColumnSelect () {
		if (this.state.useCurrentColumns) return null;

		const possibleColumns = this.getListUIElements().map((el, i) => {
			if (el.type === 'heading') {
				return <PopoutList.Heading key={'heading_' + i}>{el.content}</PopoutList.Heading>;
			}

			const columnKey = el.field.path;
			const columnValue = this.state.selectedColumns[columnKey];

			return (
				<PopoutList.Item
					key={'item_' + el.field.path}
					icon={columnValue ? 'check' : 'dash'}
					iconHover={columnValue ? 'dash' : 'check'}
					isSelected={columnValue}
					label={el.field.label}
					onClick={() => this.toggleColumn(columnKey, !columnValue)} />
			);
		});

		const allColumnsSelected = this.allColumnsSelected();
		const checkboxLabel = allColumnsSelected ? 'Select None' : 'Select All';

		return (
			<div>
				<FormField offsetAbsentLabel>
					<LabelledControl
						checked={allColumnsSelected}
						label={checkboxLabel}
						onChange={this.clickSelectAll}
						type="checkbox"
						value
					/>
				</FormField>
				<div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', marginTop: '1em', paddingTop: '1em' }}>
					{possibleColumns}
				</div>
			</div>
		);
	},
	render () {
		const { useCurrentColumns, gSheetStatus, gSheetError } = this.state;
		let alertText = 'Fill in your data.';
		let alertColor = 'info';
		if (gSheetStatus === 'error') {
			alertText = `An error occured. ${gSheetError}`;
			alertColor = 'danger';
		} else if (gSheetStatus === 'pending') {
			alertText = 'Applying changes. Please wait.';
			alertColor = 'warning';
		} else if (gSheetStatus === 'done') {
			alertText = 'All operations complete!';
			alertColor = 'success';
		}
		return (
			<div>
				<ListHeaderButton
					active={this.state.isOpen}
					id="listHeaderDownloadButton"
					glyph="cloud-download"
					label="Download"
					onClick={() => this.togglePopout(!this.state.isOpen)}
				/>
				<Popout isOpen={this.state.isOpen} onCancel={() => this.togglePopout(false)} relativeToID="listHeaderDownloadButton">
					<Popout.Header title="Download" />
					<Popout.Body scrollable>
						<Form layout="horizontal" labelWidth={100} component="div">
							<FormField label="File format:">
								<SegmentedControl
									equalWidthSegments
									onChange={this.changeFormat}
									options={FORMAT_OPTIONS}
									value={this.state.format}
								/>
							</FormField>
							<FormField label="Columns:" style={{ marginBottom: 0 }}>
								<LabelledControl
									autoFocus
									checked={useCurrentColumns}
									label="Use currently selected"
									onChange={this.toggleCurrentlySelectedColumns}
									type="checkbox"
									value
								/>
							</FormField>
							{this.renderColumnSelect()}
						</Form>
					</Popout.Body>
					<Popout.Footer
						primaryButtonAction={this.handleDownloadRequest}
						primaryButtonLabel="Download"
						secondaryButtonAction={() => this.togglePopout(false)}
						secondaryButtonLabel="Cancel" />
				</Popout>
				<Modal.Dialog isOpen={this.state.isModalOpen} onClose={this.modalClose} onCancel={this.modalClose} backdropClosesModal>
					<Modal.Header text="Google Sheets Options"/>
					<Modal.Body>
						<Alert color={alertColor}>
							<p style={{ textAlign: 'center' }}>{alertText}</p>
						</Alert>
						<Form>
							<FormField label="API Key">
								<FormInput type="text" placeholder="Your API key here" value={this.state.gapiKey} onChange={this.onGAPIKey} />
							</FormField>
							<FormField label="Client ID">
								<FormInput type="text" placeholder="Your Client ID here" value={this.state.gClientID} onChange={this.onGClientID} />
							</FormField>
							<FormField label="Google Sheet URL or ID">
								<FormInput type="text" placeholder="Your Google Sheet here" value={this.state.gSheetID} onChange={this.onGSheetID}/>
							</FormField>
						</Form>
					</Modal.Body>
					<Modal.Footer>
						<Button style={{ marginLeft: 'auto' }} color="primary" disabled={this.state.gSheetSendState !== 'ready'} onClick={this.submitGSheet}>
							{this.state.gSheetSendState === 'ready'
								? 'Send'
								: <Spinner />
							}
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</div>
		);
	},
});

module.exports = connect((state) => ({ active: state.active }))(ListDownloadForm);
