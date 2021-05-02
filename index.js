'use strict';

const crypto = require('crypto');
const config = require('config');
const request = require('request');
const pug = require('pug');
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
		return `https://adapterbot.herokuapp.com/${this.getToken(chat_id)}/${chat_id}`;
	}

	static sendMessage(message) {
		return new Promise((resolve, reject) => {
			request.post({
				url: `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN || config.telegram.token}/sendMessage`,
				form: message
			}, (error, response, body) => {
				if (error) {
					reject(error);
					console.error(error);
				} else {
					resolve(JSON.parse(body));
					console.log(JSON.parse(body));
				}
			});
		});
	}
}

koaRouter.all('/', async (ctx, next) => {
	ctx.redirect('https://telegram.me/adapterbot');
});

koaRouter.post('/:token/webhook', koaBody, async (ctx, next) => {
	if (ctx.params.token == (process.env.TELEGRAM_TOKEN || config.telegram.token)) {
		if (['/start', '/help', '/help@adapterbot'].includes(ctx.request.body.message.text)) {
			await Adapter.sendMessage({
				chat_id: ctx.request.body.message.chat.id,
				text: pug.renderFile('./views/help.pug', { url: Adapter.getWebHookURL(ctx.request.body.message.chat.id) }),
				disable_web_page_preview: true
			})
				.then(response => {
					ctx.status = 200;
				})
				.catch(error => {
					ctx.status = 400;
				});
		} else {
			ctx.status = 200;
		}
	} else {
		ctx.status = 400;
	}
});

koaRouter.get('/:token/:chat_id', async (ctx, next) => {
	if (ctx.params.token == Adapter.getToken(ctx.params.chat_id)) {
		await Adapter.sendMessage(Object.assign({}, ctx.request.query, { chat_id: ctx.params.chat_id }))
			.then(async response => {
				if (response.ok) {
					await ctx.render('success', { message: 'Message Sent' });
				} else {
					ctx.throw(response.error_code, response.description, response);
				}
			})
			.catch(error => {
				ctx.throw(400, 'Bad Request', error);
			});
	} else {
		ctx.throw(400, 'Bad Request');
	}
});

koaRouter.post('/:token/:chat_id', koaBody, async (ctx, next) => {
	if (ctx.params.token == Adapter.getToken(ctx.params.chat_id)) {
		await Adapter.sendMessage(Object.assign({}, ctx.request.body, { chat_id: ctx.params.chat_id }))
			.then(async response => {
				if (response.ok) {
					await ctx.render('success', { message: 'Message Sent' });
				} else {
					ctx.throw(response.error_code, response.description, response);
				}
			})
			.catch(error => {
				ctx.throw(400, 'Bad Request', error);
			});
	} else {
		ctx.throw(400, 'Bad Request');
	}
});

app.use(async (ctx, next) => {
	try {
		await next();
		if (ctx.status == 404) ctx.throw(404, 'Not Found');
	} catch (error) {
		ctx.status = error.status || 500;
		await ctx.render('error', { message: error.message });
	}
});

app.use(koaLogger);
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', { extension: 'pug' }));
app.use(koaRouter.routes());

app.listen(process.env.PORT || config.port);
