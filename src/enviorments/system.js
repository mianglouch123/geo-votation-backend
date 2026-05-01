import 'dotenv/config';

export class SystemEnv {

/**  @type {Number} */
API_PORT
static #instance = null;


constructor() {
this.API_PORT = process.env.API_PORT || 3000;
}

static getInstance() {
  if(!this.#instance) {
	this.#instance = Object.freeze(new SystemEnv());
  }
return this.#instance;

}




}