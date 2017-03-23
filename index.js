'use strict';

const crypto = require('crypto');
const config = require('config');
const commander = require('commander');
const request = require('request');
const koaViews = require('koa-views');
const koaLogger = require('koa-logger');
const koaStatic = require('koa-static');
const koaBodyparser = require('koa-bodyparser');
const koaRouter = require('koa-router')();
const koa = require('koa');
const app = new koa();

class Adapter {
	static request(url) {
		return new Promise((resolve, reject) => {
			request(url, (error, response, body) => {
				if (!error && response.statusCode == 200) {
					resolve(body);
				} else {
					reject(error);
				}
			});
		});
	}

	static getToken(salt, id, tag = '') {
		salt = salt.toString();
		id = id.toString();
		tag = tag.toString();

		if (tag) {
			return crypto.createHash('md5').update(salt + id + tag).digest('hex');
		} else {
			return crypto.createHash('md5').update(salt + id).digest('hex');
		}
	}

	static getWebHookURL(salt, id, tag = '') {
		salt = salt.toString();
		id = id.toString();
		tag = tag.toString();

		if (tag) {
			return `https://adapter.yamstr.com/${Adapter.getToken(salt, id, tag)}/${id}/${tag}`;
		} else {
			return `https://adapter.yamstr.com/${Adapter.getToken(salt, id)}/${id}`;
		}
	}
}

commander
	.version('0.0.1')
	.option('getwh', 'get webhook')
	.option('setwh [url]', 'set webhook')
	.option('delwh', 'delete webhook')
	.option('start', 'start adapter')
	.parse(process.argv);

if (commander.getwh) {
	Adapter.request(`https://api.telegram.org/bot${config.token}/getWebhookInfo`)
		.then(response => console.log(response))
		.catch(error => console.error(error));
}

if (commander.setwh) {
	Adapter.request(`https://api.telegram.org/bot${config.token}/setWebhook?url=${commander.setwh}`)
		.then(response => console.log(response))
		.catch(error => console.error(error));
}

if (commander.delwh) {
	Adapter.request(`https://api.telegram.org/bot${config.token}/deleteWebhook`)
		.then(response => console.log(response))
		.catch(error => console.error(error));
}

if (commander.start) {
	koaRouter.all('/', async (ctx, next) => {
		ctx.redirect('https://telegram.me/adapterbot');
	});

	koaRouter.post('/webhook', async (ctx, next) => {
		if (['/start', '/getwh', '/getwh@adapterbot'].includes(ctx.request.body.message.text)) {
			let message = `WebHook URL: ${Adapter.getWebHookURL(config.salt, ctx.request.body.message.chat.id)}?text=hello`;
			let url = `https://api.telegram.org/bot${config.token}/sendMessage?chat_id=${ctx.request.body.message.chat.id}&text=${message}`;

			console.log(ctx.request.body.message.text);
			console.log(await Adapter.request(url));
		} else {
			console.log(ctx.request.body);
		}

		ctx.status = 200;
	});

	koaRouter.get('/:token/:id', async (ctx, next) => {
		if (ctx.params.token == Adapter.getToken(config.salt, ctx.params.id)) {
			console.log(await Adapter.request(`https://api.telegram.org/bot${config.token}/sendMessage?chat_id=${ctx.params.id}&text=${encodeURIComponent(ctx.request.query.text)}`));
		}

		ctx.status = 200;
	});

	app.use(async (ctx, next) => {
		try {
			await next();
		} catch (err) {
			ctx.status = err.status || 500;
			ctx.body = {
				message: err.message
			};
		}
	});

	app.use(koaViews(__dirname + '/views', { extension: 'pug' }));
	app.use(koaLogger());
	app.use(koaStatic(__dirname + '/public'));
	app.use(koaBodyparser());
	app.use(koaRouter.routes());

	app.listen(config.port);
}