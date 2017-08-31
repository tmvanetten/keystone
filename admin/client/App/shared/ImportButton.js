import React from "react";
import { Modal, Button } from "../elemental";
import Dropzone from "react-dropzone";
import Papa from "papaparse";

export default class ImportButton extends React.Component {
	state = {
		open: false,
		error: null,
		csvData: null
	};

	generateTitleMap(){
		const { currentList } = this.props;
		let titleMap = {};
		for (let i=0; i< currentList.columns.length; i+=1){
			const col = currentList.columns[i];
			titleMap[col.title] = col.path;
		}
		return titleMap;
	}

	// The file is being parsed and translated after being dropped (or opened).
	onDrop = acceptedFiles => {
		const file = acceptedFiles[0];
		const self = this;
		Papa.parse(file, {
			header: true,
			dynamicTyping: true,
			// TODO:  We might have issues with big files using all the memory.
			// Unfortunately every possible solution involves huge RAM usage anyways if the CSV is big
			// In fact, stepping threw the rows and dispatching PUTs might make RAM usage worse
			complete(result) {
				const translatedData = [];
				const data = result.data;
				for (let i = 0; i < data.length; i += 1) {
					const row = data[i];
					const translatedRow = {};
					const rowKeys = Object.keys(row);
					let emptyFields = 0;
					const paths = [];
					const titleMap = self.generateTitleMap()
					console.log(titleMap);
					for (let j = 0; j < rowKeys.length; j += 1) {
						const title = rowKeys[j];
						// In case of missing title configuration, use the titles themselves as paths.
						if (titleMap.hasOwnProperty(title)) {
							const path = titleMap[title];
							paths.push(path);
							translatedRow[path] = row[title];
							// Count the number of empty properties.
							if (!row[title]) {
								emptyFields += 1;
							}
						}
					}
					// If all the properties are empty, ignore the line.
					// CSV files commonly leave empty lines in the end of the document
					if (emptyFields !== paths.length) {
						translatedData.push(translatedRow);
					}
				}
				console.log(result);
				console.log(translatedData);
				self.setState({
					file,
					csvData: translatedData
				});
			}
		});
	};
	onDropRejected = () => {
		this.showError("File loading rejected.");
	};

	showError = error => {
		// Shows a red error instead of instruction in case something goes wrong.
		this.setState({ error });
	};
	handleOpen = () => {
		this.setState({ open: true });
	};

	handleClose = () => {
		this.setState({ open: false });
	};

	render() {
		const { file, error, csvData } = this.state;
		const actions = [
			<Button type="primary" onClick={this.handleClose}>
				Cancel
			</Button>
			// This is the button responsible for pushing the data to the server.
			// TODO: Fix this
			// <BulkUpdateButton resource={this.props.resource} CSVData={csvData} clickAction={this.handleClose} disabled={!csvData} />,
		];
		const dropZoneStyle = {
			display: "flex",
			justifyContent: "center",
			padding: "10px",
			textAlign: "center",
			backgroundColor: "rgba(153,153,153,0.2)"
		};
		// Error/hint colors and texts are determined here
		let paragraphColor = error ? "red" : "rgba(0,0,0,0.6)";
		paragraphColor = !error && file ? "green" : paragraphColor;
		const paragraphStatus = file
			? "File loaded! Press submit to apply changes."
			: "Drop CSV file here, or click to select file to upload.";
			console.log(this.props);
			console.log('KEYSTONE', Keystone);
		return (
			<div>
				<Button
					type="primary"
					onClick={this.handleOpen}
					style={{ marginRight: "20px" }}
				>
					Import
				</Button>
				<Modal.Dialog
					title="Import your data"
					isOpen={this.state.open}
					onCancel={this.handleClose}
					onClose={this.handleClose}
					backdropClosesModal
				>
					<Modal.Header text="Import your data"/>
					<section>
						<div className="dropzone">
							<Dropzone
								style={dropZoneStyle}
								onDrop={this.onDrop}
								onDropRejected={this.onDropRejected}
							>
								<p style={{ color: paragraphColor }}>
									{error || paragraphStatus}
								</p>
							</Dropzone>
						</div>
						<aside>
							<h2>Selected file</h2>
							<ul>
								{file && (
									<li
										key={
											file.name // Shows the information about the file
										}
									>
										{file.name} - {file.size} bytes
									</li>
								)}
							</ul>
						</aside>
					</section>
					<Modal.Footer>{actions}</Modal.Footer>
				</Modal.Dialog>
			</div>
		);
	}
}
