'use strict';

const crypto = require('crypto');
const config = require('config');
const request = require('request');
const koa = require('koa');
const koaBody = require('koa-body')();
const koaLogger = require('koa-logger')();
const koaRouter = require('koa-router')();
const koaStatic = require('koa-static');
const koaViews = require('koa-views');
const app = new koa();

class Adapter {
	static getToken(chat_id) {
		return crypto.createHash('md5').update((process.env.SALT || config.salt) + chat_id).digest('hex');
	}

	static getWebHookURL(chat_id) {
		return `https://adapter.yamstr.com/${this.getToken(chat_id)}/${chat_id}`;
	}

	static sendMessage(chat_id, text) {
		return new Promise((resolve, reject) => {
			request.post({
				url: `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN || config.telegram.token}/sendMessage`,
				form: {
					chat_id: chat_id,
					text: text
				}
			}, (error, response, body) => {
				if (error) {
					console.error(error);
					reject(error);
				} else {
					console.log(body);
					resolve(body);
				}
			});
		});
	}
}

koaRouter.all('/', async (ctx, next) => {
	ctx.redirect('https://telegram.me/adapterbot');
});

koaRouter.all('/:token/:chat_id', koaBody, async (ctx, next) => {
	let text;

	if (ctx.method == 'GET') text = ctx.request.query.text;
	if (ctx.method == 'POST') text = ctx.request.body.text;

	if (ctx.params.token == Adapter.getToken(ctx.params.chat_id)) {
		await Adapter.sendMessage(ctx.params.chat_id, text)
			.then(response => {
				ctx.status = 200;
			})
			.catch(error => {
				ctx.status = 400;
			});
	} else {
		ctx.status = 400;
	}
});

koaRouter.post('/webhook', koaBody, async (ctx, next) => {
	if (['/start', '/getwh', '/getwh@adapterbot'].includes(ctx.request.body.message.text)) {
		await Adapter.sendMessage(ctx.request.body.message.chat.id, `WebHook URL: ${Adapter.getWebHookURL(ctx.request.body.message.chat.id)}?text=hello`)
			.then(response => {
				ctx.status = 200;
			})
			.catch(error => {
				ctx.status = 400;
			});
	} else {
		ctx.status = 200;
	}
});

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (error) {
		ctx.status = error.status || 500;
		ctx.body = {
			message: error.message
		};
	}
});

app.use(koaLogger);
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', { extension: 'pug' }));
app.use(koaRouter.routes());

app.listen(process.env.PORT || config.port);